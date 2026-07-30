import { JsonRpcProvider } from "ethers";
import pino from "pino";
import { loadConfig } from "./config.js";
import { Store } from "./db.js";
import { HoldingIndexer } from "./indexer.js";
import { startMetricsServer } from "./metrics.js";
import { OracleReporter } from "./oracle.js";

const config = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const provider = new JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: false });
const store = new Store(config.databaseUrl);
const indexer = new HoldingIndexer(config, store, provider, logger);
const reporter = new OracleReporter(config, store, provider, logger);

let ready = false;
let stopping = false;
const metricsServer = startMetricsServer(config.metricsPort, () => ready);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "shutdown requested");
    stopping = true;
  });
}

try {
  await store.migrate();
  await store.acquireSingletonLock();
  await indexer.initialize();
  ready = true;
  let nextOracleAt = 0;

  while (!stopping) {
    try {
      const progressed = await indexer.tick();
      if (!progressed && Date.now() >= nextOracleAt) {
        const head = await provider.getBlockNumber();
        const finalizedBlockNumber = head - config.confirmations;
        const finalized = finalizedBlockNumber >= 0
          ? await provider.getBlock(finalizedBlockNumber)
          : null;
        if (finalized) {
          const latestReportTimestamp = Math.floor(finalized.timestamp / 3_600) * 3_600;
          let reportTimestamp = await store.nextOracleReportTimestamp(
            latestReportTimestamp,
            config.submitTransactions,
          );
          while (!stopping && reportTimestamp !== null) {
            await reporter.report(reportTimestamp);
            reportTimestamp = await store.nextOracleReportTimestamp(
              latestReportTimestamp,
              config.submitTransactions,
            );
          }
        }
        nextOracleAt = Date.now() + config.oracleIntervalMs;
      }
      if (!progressed) await delay(config.pollIntervalMs);
    } catch (error) {
      logger.error({ error }, "service loop failed");
      await delay(config.pollIntervalMs);
    }
  }
} catch (error) {
  logger.fatal({ error }, "holding indexer failed to start");
  process.exitCode = 1;
} finally {
  ready = false;
  metricsServer.close();
  await store.close();
  provider.destroy();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
