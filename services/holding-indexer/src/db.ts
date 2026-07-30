import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { computeTwab, TWAB_WINDOW_SECONDS, type TimedDelta } from "./twab.js";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface Transfer {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  from: string;
  to: string;
  amount: bigint;
}

export interface HoldingTwab {
  address: string;
  average: bigint;
  remainder: bigint;
}

export class Store {
  readonly pool: Pool;
  private lockClient?: PoolClient;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "holding-indexer",
    });
  }

  async close(): Promise<void> {
    if (this.lockClient) {
      try {
        await this.lockClient.query("SELECT pg_advisory_unlock(hashtext('holding-indexer'))");
      } finally {
        this.lockClient.release();
        delete this.lockClient;
      }
    }
    await this.pool.end();
  }

  async acquireSingletonLock(): Promise<void> {
    if (this.lockClient) return;
    const client = await this.pool.connect();
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('holding-indexer')) AS acquired",
    );
    if (!result.rows[0]?.acquired) {
      client.release();
      throw new Error("Another holding-indexer instance owns the database lock");
    }
    this.lockClient = client;
  }

  async migrate(): Promise<void> {
    const sql = await readFile(resolve(process.cwd(), "migrations/001_init.sql"), "utf8");
    await this.pool.query(sql);
  }

  async initialize(startBlock: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO indexer_state (id, next_block) VALUES (true, $1)
       ON CONFLICT (id) DO NOTHING`,
      [startBlock],
    );
  }

  async nextBlock(): Promise<number> {
    const result = await this.pool.query<{ next_block: string }>(
      "SELECT next_block FROM indexer_state WHERE id = true",
    );
    if (!result.rows[0]) throw new Error("Indexer state is not initialized");
    return Number(result.rows[0].next_block);
  }

  async latestAnchors(): Promise<Array<{ blockNumber: number; blockHash: string }>> {
    const result = await this.pool.query<{ block_number: string; block_hash: string }>(
      "SELECT block_number, block_hash FROM block_anchors ORDER BY block_number DESC",
    );
    return result.rows.map((row) => ({
      blockNumber: Number(row.block_number),
      blockHash: row.block_hash,
    }));
  }

  async commitBatch(transfers: readonly Transfer[], endBlock: number, endBlockHash: string): Promise<number> {
    return this.transaction(async (client) => {
      let inserted = 0;
      const deltas = new Map<string, bigint>();

      const addDelta = (address: string, delta: bigint) => {
        deltas.set(address, (deltas.get(address) ?? 0n) + delta);
      };

      for (const transfer of transfers) {
        const result = await client.query(
          `INSERT INTO transfer_events
             (tx_hash, log_index, block_number, block_hash, block_timestamp,
              from_address, to_address, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tx_hash, log_index) DO NOTHING
           RETURNING tx_hash`,
          [
            transfer.txHash,
            transfer.logIndex,
            transfer.blockNumber,
            transfer.blockHash,
            transfer.blockTimestamp,
            transfer.from,
            transfer.to,
            transfer.amount.toString(),
          ],
        );
        if (result.rowCount === 0) continue;
        inserted += 1;
        if (transfer.from !== ZERO_ADDRESS) addDelta(transfer.from, -transfer.amount);
        if (transfer.to !== ZERO_ADDRESS) addDelta(transfer.to, transfer.amount);
      }

      // Apply credits before debits so the non-negative balance constraint holds
      // even when RPC log order is imperfect within a multi-block batch.
      const ordered = [...deltas.entries()].sort((a, b) => {
        if (a[1] === b[1]) return a[0].localeCompare(b[0]);
        return a[1] > b[1] ? -1 : 1;
      });
      for (const [address, delta] of ordered) {
        if (delta !== 0n) await this.adjustBalance(client, address, delta);
      }

      await client.query(
        `INSERT INTO block_anchors (block_number, block_hash) VALUES ($1, $2)
         ON CONFLICT (block_number) DO UPDATE SET block_hash = EXCLUDED.block_hash`,
        [endBlock, endBlockHash],
      );
      await client.query(
        "UPDATE indexer_state SET next_block = $1, updated_at = now() WHERE id = true",
        [endBlock + 1],
      );
      return inserted;
    });
  }

  async rollbackAfter(blockNumber: number): Promise<void> {
    await this.transaction(async (client) => {
      await client.query("DELETE FROM transfer_events WHERE block_number > $1", [blockNumber]);
      await client.query("DELETE FROM block_anchors WHERE block_number > $1", [blockNumber]);
      await client.query("TRUNCATE balances");
      await client.query(
        `INSERT INTO balances (address, amount)
         SELECT address, SUM(delta)
         FROM (
           SELECT to_address AS address, amount AS delta FROM transfer_events
           WHERE to_address <> $1
           UNION ALL
           SELECT from_address AS address, -amount AS delta FROM transfer_events
           WHERE from_address <> $1
         ) changes
         GROUP BY address`,
        [ZERO_ADDRESS],
      );
      await client.query(
        "UPDATE indexer_state SET next_block = $1, updated_at = now() WHERE id = true",
        [blockNumber + 1],
      );
    });
  }

  async twabsAt(reportTimestamp: number): Promise<HoldingTwab[]> {
    const windowStart = reportTimestamp - TWAB_WINDOW_SECONDS;
    const baselines = await this.pool.query<{ address: string; amount: string }>(
      `SELECT address, SUM(delta)::text AS amount
       FROM (
         SELECT to_address AS address, amount AS delta FROM transfer_events
         WHERE block_timestamp < $1 AND to_address <> $2
         UNION ALL
         SELECT from_address AS address, -amount AS delta FROM transfer_events
         WHERE block_timestamp < $1 AND from_address <> $2
       ) changes
       GROUP BY address
       UNION
       SELECT address, '0' FROM balances
       WHERE address NOT IN (
         SELECT address FROM (
           SELECT to_address AS address FROM transfer_events WHERE block_timestamp < $1 AND to_address <> $2
           UNION SELECT from_address FROM transfer_events WHERE block_timestamp < $1 AND from_address <> $2
         ) prior
       )
       ORDER BY address`,
      [windowStart, ZERO_ADDRESS],
    );
    const events = await this.pool.query<{
      address: string;
      block_timestamp: string;
      delta: string;
    }>(
      `SELECT address, block_timestamp, SUM(delta)::text AS delta
       FROM (
         SELECT to_address AS address, block_timestamp, amount AS delta
         FROM transfer_events
         WHERE block_timestamp >= $1 AND block_timestamp <= $2 AND to_address <> $3
         UNION ALL
         SELECT from_address AS address, block_timestamp, -amount AS delta
         FROM transfer_events
         WHERE block_timestamp >= $1 AND block_timestamp <= $2 AND from_address <> $3
       ) changes
       GROUP BY address, block_timestamp
       ORDER BY address, block_timestamp`,
      [windowStart, reportTimestamp, ZERO_ADDRESS],
    );

    const changes = new Map<string, TimedDelta[]>();
    for (const event of events.rows) {
      const list = changes.get(event.address) ?? [];
      list.push({ timestamp: Number(event.block_timestamp), delta: BigInt(event.delta) });
      changes.set(event.address, list);
    }

    return baselines.rows.map((row) => {
      const value = computeTwab(
        BigInt(row.amount),
        changes.get(row.address) ?? [],
        windowStart,
        reportTimestamp,
      );
      return { address: row.address, average: value.average, remainder: value.remainder };
    });
  }

  async nextOracleReportTimestamp(
    latestAvailableTimestamp: number,
    submitTransactions: boolean,
  ): Promise<number | null> {
    const unfinished = await this.pool.query<{ report_timestamp: string }>(
      `SELECT MIN(report_timestamp)::text AS report_timestamp
       FROM oracle_runs
       WHERE status IN ('pending', 'submitted', 'failed'${submitTransactions ? ", 'dry_run'" : ""})
         AND report_timestamp <= $1`,
      [latestAvailableTimestamp],
    );
    if (unfinished.rows[0]?.report_timestamp) {
      return Number(unfinished.rows[0].report_timestamp);
    }

    const completed = await this.pool.query<{ report_timestamp: string | null }>(
      `SELECT MAX(report_timestamp)::text AS report_timestamp
       FROM oracle_runs
       WHERE status IN ('confirmed'${submitTransactions ? "" : ", 'dry_run'"})`,
    );
    const previous = completed.rows[0]?.report_timestamp;
    if (previous === null || previous === undefined) return latestAvailableTimestamp;
    const next = Number(previous) + 3_600;
    return next <= latestAvailableTimestamp ? next : null;
  }

  async ensureOracleRun(reportTimestamp: number, dryRun: boolean): Promise<"pending" | "dry_run" | "confirmed"> {
    await this.pool.query(
      `INSERT INTO oracle_runs (report_timestamp, status) VALUES ($1, $2)
       ON CONFLICT (report_timestamp) DO NOTHING`,
      [reportTimestamp, dryRun ? "dry_run" : "pending"],
    );
    if (!dryRun) {
      await this.pool.query(
        `UPDATE oracle_runs SET status = 'pending', updated_at = now()
         WHERE report_timestamp = $1 AND status IN ('dry_run', 'failed')`,
        [reportTimestamp],
      );
    }
    const result = await this.pool.query<{ status: string }>(
      "SELECT status FROM oracle_runs WHERE report_timestamp = $1",
      [reportTimestamp],
    );
    return result.rows[0]?.status === "confirmed" ? "confirmed" : dryRun ? "dry_run" : "pending";
  }

  async oracleBatchStates(reportTimestamp: number): Promise<Map<number, { status: string; transactionHash?: string }>> {
    const result = await this.pool.query<{
      batch_index: number;
      status: string;
      transaction_hash: string | null;
    }>(
      `SELECT batch_index, status, transaction_hash FROM oracle_batches
       WHERE report_timestamp = $1`,
      [reportTimestamp],
    );
    return new Map(result.rows.map((row) => [
      row.batch_index,
      {
        status: row.status,
        ...(row.transaction_hash ? { transactionHash: row.transaction_hash } : {}),
      },
    ]));
  }

  async setOracleBatch(
    reportTimestamp: number,
    batchIndex: number,
    status: "pending" | "submitted" | "confirmed" | "failed" | "dry_run",
    transactionHash?: string,
    error?: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO oracle_batches
         (report_timestamp, batch_index, status, transaction_hash, error)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (report_timestamp, batch_index) DO UPDATE
       SET status = EXCLUDED.status, transaction_hash = EXCLUDED.transaction_hash,
           error = EXCLUDED.error, updated_at = now()`,
      [reportTimestamp, batchIndex, status, transactionHash ?? null, error ?? null],
    );
  }

  async finishOracleRun(
    reportTimestamp: number,
    status: "submitted" | "confirmed" | "failed",
    transactionHash?: string,
    error?: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE oracle_runs
       SET status = $2, transaction_hash = $3, error = $4, updated_at = now()
       WHERE report_timestamp = $1`,
      [reportTimestamp, status, transactionHash ?? null, error ?? null],
    );
  }

  private async adjustBalance(client: PoolClient, address: string, delta: bigint): Promise<void> {
    await client.query(
      `INSERT INTO balances (address, amount) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE
       SET amount = balances.amount + EXCLUDED.amount, updated_at = now()`,
      [address, delta.toString()],
    );
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
