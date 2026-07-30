import {
  Interface,
  JsonRpcProvider,
  getAddress,
  type Log,
} from "ethers";
import type { Config } from "./config.js";
import { Store, type Transfer } from "./db.js";
import {
  chainHead,
  indexedBlock,
  indexedTransfers,
  operationDuration,
  reorgs,
  rpcRetries,
} from "./metrics.js";
import { retry } from "./retry.js";

const transferInterface = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const transferTopic = transferInterface.getEvent("Transfer")!.topicHash;

interface Logger {
  info(data: object, message: string): void;
  warn(data: object, message: string): void;
}

export class HoldingIndexer {
  constructor(
    private readonly config: Config,
    private readonly store: Store,
    private readonly provider: JsonRpcProvider,
    private readonly logger: Logger,
  ) {}

  async initialize(): Promise<void> {
    await this.store.initialize(this.config.startBlock);
    await this.reconcileCanonicalChain();
  }

  async tick(): Promise<boolean> {
    const stopTimer = operationDuration.startTimer({ operation: "index_batch" });
    try {
      await this.reconcileCanonicalChain();
      const head = await this.rpc("block_number", () => this.provider.getBlockNumber());
      chainHead.set(head);
      const finalizedHead = head - this.config.confirmations;
      const fromBlock = await this.store.nextBlock();
      if (fromBlock > finalizedHead) return false;

      const toBlock = Math.min(finalizedHead, fromBlock + this.config.blockBatchSize - 1);
      const logs = await this.rpc("get_logs", () =>
        this.provider.getLogs({
          address: this.config.tokenAddress,
          topics: [transferTopic],
          fromBlock,
          toBlock,
        }),
      );
      const transfers = (await this.decodeTransfers(logs)).sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return a.logIndex - b.logIndex;
      });
      const endBlock = await this.rpc("get_block", () => this.provider.getBlock(toBlock));
      if (!endBlock?.hash) throw new Error(`Block ${toBlock} was unavailable or unmined`);

      const inserted = await this.store.commitBatch(transfers, toBlock, endBlock.hash);
      indexedTransfers.inc(inserted);
      indexedBlock.set(toBlock);
      this.logger.info(
        { fromBlock, toBlock, logs: logs.length, inserted },
        "indexed finalized block batch",
      );
      return true;
    } finally {
      stopTimer();
    }
  }

  private async reconcileCanonicalChain(): Promise<void> {
    const anchors = await this.store.latestAnchors();
    if (anchors.length === 0) return;

    for (const [index, anchor] of anchors.entries()) {
      const block = await this.rpc("reorg_check", () => this.provider.getBlock(anchor.blockNumber));
      if (block?.hash?.toLowerCase() === anchor.blockHash.toLowerCase()) {
        if (index > 0) {
          reorgs.inc();
          await this.store.rollbackAfter(anchor.blockNumber);
          this.logger.warn({ rollbackBlock: anchor.blockNumber }, "reorg detected and rolled back");
        }
        return;
      }
    }

    reorgs.inc();
    await this.store.rollbackAfter(this.config.startBlock - 1);
    this.logger.warn({ startBlock: this.config.startBlock }, "all stored anchors orphaned; reset index");
  }

  private async decodeTransfers(logs: readonly Log[]): Promise<Transfer[]> {
    const timestamps = new Map<number, number>();
    await Promise.all(
      [...new Set(logs.map((log) => log.blockNumber))].map(async (blockNumber) => {
        const block = await this.rpc("get_block", () => this.provider.getBlock(blockNumber));
        if (!block) throw new Error(`Block ${blockNumber} was unavailable`);
        timestamps.set(blockNumber, block.timestamp);
      }),
    );

    return logs.map((log) => {
      const parsed = transferInterface.parseLog(log);
      if (!parsed) throw new Error(`Could not parse Transfer log ${log.transactionHash}:${log.index}`);
      return {
        txHash: log.transactionHash.toLowerCase(),
        logIndex: log.index,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        blockTimestamp: timestamps.get(log.blockNumber)!,
        from: getAddress(parsed.args.from).toLowerCase(),
        to: getAddress(parsed.args.to).toLowerCase(),
        amount: parsed.args.value as bigint,
      };
    });
  }

  private rpc<T>(operation: string, task: () => Promise<T>): Promise<T> {
    return retry(task, {
      attempts: this.config.maxRetries,
      onRetry: (error, attempt, delayMs) => {
        rpcRetries.inc({ operation });
        this.logger.warn({ operation, attempt, delayMs, error }, "RPC request failed; retrying");
      },
    });
  }
}
