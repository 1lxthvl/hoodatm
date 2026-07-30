import {
  AbiCoder,
  Interface,
  JsonRpcProvider,
  Wallet,
  keccak256,
  type TransactionReceipt,
} from "ethers";
import type { Config } from "./config.js";
import { Store, type HoldingTwab } from "./db.js";
import { operationDuration, oracleRuns, rpcRetries } from "./metrics.js";
import { retry } from "./retry.js";

const oracleInterface = new Interface([
  "function isBatchSubmitted(bytes32 batchId) view returns (bool)",
  "function submitBatch(bytes32 batchId, uint64 reportTimestamp, address[] accounts, uint256[] twabs)",
]);

interface Logger {
  info(data: object, message: string): void;
  warn(data: object, message: string): void;
}

export class OracleReporter {
  private readonly wallet?: Wallet;

  constructor(
    private readonly config: Config,
    private readonly store: Store,
    private readonly provider: JsonRpcProvider,
    private readonly logger: Logger,
  ) {
    if (config.submitTransactions) {
      if (!config.reporterPrivateKey) {
        throw new Error("REPORTER_PRIVATE_KEY is required when SUBMIT_TRANSACTIONS=true");
      }
      this.wallet = new Wallet(config.reporterPrivateKey, provider);
    }
  }

  async report(reportTimestamp: number): Promise<void> {
    if (reportTimestamp % 3_600 !== 0) throw new Error("Oracle report timestamp must be hour-aligned");
    const stopTimer = operationDuration.startTimer({ operation: "oracle_report" });
    try {
      const dryRun = !this.config.submitTransactions;
      const runStatus = await this.store.ensureOracleRun(reportTimestamp, dryRun);
      if (runStatus === "confirmed") return;

      const holdings = await this.store.twabsAt(reportTimestamp);
      const batches = chunk(holdings, this.config.oracleBatchSize);
      const states = await this.store.oracleBatchStates(reportTimestamp);

      for (const [batchIndex, batch] of batches.entries()) {
        const state = states.get(batchIndex);
        if (state?.status === "confirmed" || (dryRun && state?.status === "dry_run")) continue;
        if (dryRun) {
          await this.store.setOracleBatch(reportTimestamp, batchIndex, "dry_run");
          continue;
        }

        if (state?.status === "submitted" && state.transactionHash) {
          const receipt = await this.resumeTransaction(state.transactionHash);
          if (receipt) {
            await this.confirmReceipt(reportTimestamp, batchIndex, receipt);
            continue;
          }
        }
        await this.submitBatch(reportTimestamp, batchIndex, batch);
      }

      if (!dryRun) {
        await this.store.finishOracleRun(reportTimestamp, "confirmed");
      }
      oracleRuns.inc({ status: dryRun ? "dry_run" : "confirmed" });
      this.logger.info(
        { reportTimestamp, holders: holdings.length, batches: batches.length, dryRun },
        "oracle report completed",
      );
    } catch (error) {
      oracleRuns.inc({ status: "failed" });
      await this.store.finishOracleRun(reportTimestamp, "failed", undefined, String(error));
      throw error;
    } finally {
      stopTimer();
    }
  }

  private async submitBatch(
    reportTimestamp: number,
    batchIndex: number,
    batch: readonly HoldingTwab[],
  ): Promise<void> {
    const addresses = batch.map((holding) => holding.address);
    const values = batch.map((holding) => holding.average);
    const batchId = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["uint64", "address[]", "uint256[]"],
        [reportTimestamp, addresses, values],
      ),
    );
    if (await this.isBatchSubmitted(batchId)) {
      await this.store.setOracleBatch(reportTimestamp, batchIndex, "confirmed");
      return;
    }

    const data = oracleInterface.encodeFunctionData("submitBatch", [
      batchId,
      reportTimestamp,
      addresses,
      values,
    ]);
    const unsigned = await this.wallet!.populateTransaction({
      to: this.config.oracleAddress,
      data,
    });
    const rawTransaction = await this.wallet!.signTransaction(unsigned);
    const response = await this.rpc("broadcast_transaction", () =>
      this.provider.broadcastTransaction(rawTransaction),
    );
    await this.store.setOracleBatch(reportTimestamp, batchIndex, "submitted", response.hash);
    const receipt = await response.wait(this.config.confirmations);
    if (!receipt) throw new Error(`Transaction ${response.hash} was not mined`);
    await this.confirmReceipt(reportTimestamp, batchIndex, receipt);
  }

  private async resumeTransaction(hash: string): Promise<TransactionReceipt | null> {
    const receipt = await this.provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    const transaction = await this.provider.getTransaction(hash);
    if (!transaction) return null;
    return transaction.wait(this.config.confirmations);
  }

  private async confirmReceipt(
    reportTimestamp: number,
    batchIndex: number,
    receipt: TransactionReceipt,
  ): Promise<void> {
    if (receipt.status !== 1) throw new Error(`Oracle transaction ${receipt.hash} reverted`);
    await this.store.setOracleBatch(reportTimestamp, batchIndex, "confirmed", receipt.hash);
  }

  private async isBatchSubmitted(batchId: string): Promise<boolean> {
    const data = oracleInterface.encodeFunctionData("isBatchSubmitted", [batchId]);
    const result = await this.rpc("oracle_read", () =>
      this.provider.call({ to: this.config.oracleAddress, data }),
    );
    return oracleInterface.decodeFunctionResult("isBatchSubmitted", result)[0] as boolean;
  }

  private rpc<T>(operation: string, task: () => Promise<T>): Promise<T> {
    return retry(task, {
      attempts: this.config.maxRetries,
      onRetry: (error, attempt, delayMs) => {
        rpcRetries.inc({ operation });
        this.logger.warn({ operation, attempt, delayMs, error }, "oracle RPC failed; retrying");
      },
    });
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Chunk size must be positive");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
