import { createServer, type Server } from "node:http";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "holding_indexer_" });

export const indexedBlock = new Gauge({
  name: "holding_indexer_indexed_block",
  help: "Most recent completely indexed block",
  registers: [registry],
});
export const chainHead = new Gauge({
  name: "holding_indexer_chain_head",
  help: "Latest observed chain head",
  registers: [registry],
});
export const indexedTransfers = new Counter({
  name: "holding_indexer_transfers_total",
  help: "Transfer events inserted",
  registers: [registry],
});
export const reorgs = new Counter({
  name: "holding_indexer_reorgs_total",
  help: "Detected finalized-chain reorganizations",
  registers: [registry],
});
export const rpcRetries = new Counter({
  name: "holding_indexer_rpc_retries_total",
  help: "Retried RPC operations",
  labelNames: ["operation"],
  registers: [registry],
});
export const oracleRuns = new Counter({
  name: "holding_indexer_oracle_runs_total",
  help: "Oracle report outcomes",
  labelNames: ["status"],
  registers: [registry],
});
export const operationDuration = new Histogram({
  name: "holding_indexer_operation_duration_seconds",
  help: "Indexer operation latency",
  labelNames: ["operation"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

export function startMetricsServer(port: number, isReady: () => boolean): Server {
  const server = createServer(async (request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200).end("ok\n");
      return;
    }
    if (request.url === "/readyz") {
      response.writeHead(isReady() ? 200 : 503).end(isReady() ? "ready\n" : "not ready\n");
      return;
    }
    if (request.url === "/metrics") {
      response.writeHead(200, { "Content-Type": registry.contentType });
      response.end(await registry.metrics());
      return;
    }
    response.writeHead(404).end("not found\n");
  });
  server.listen(port);
  return server;
}
