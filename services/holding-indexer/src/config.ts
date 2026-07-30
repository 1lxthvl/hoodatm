export type Config = ReturnType<typeof loadConfig>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function integer(name: string, fallback: number, minimum = 0): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function loadConfig() {
  const tokenAddress = required("TOKEN_ADDRESS");
  const oracleAddress = required("ORACLE_ADDRESS");
  if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) throw new Error("TOKEN_ADDRESS is invalid");
  if (!/^0x[0-9a-fA-F]{40}$/.test(oracleAddress)) throw new Error("ORACLE_ADDRESS is invalid");

  return {
    rpcUrl: required("RPC_URL"),
    databaseUrl: required("DATABASE_URL"),
    tokenAddress,
    oracleAddress,
    startBlock: integer("START_BLOCK", 0),
    confirmations: integer("CONFIRMATIONS", 12, 1),
    blockBatchSize: integer("BLOCK_BATCH_SIZE", 2_000, 1),
    pollIntervalMs: integer("POLL_INTERVAL_MS", 12_000, 100),
    oracleIntervalMs: integer("ORACLE_INTERVAL_MS", 3_600_000, 1_000),
    oracleBatchSize: integer("ORACLE_BATCH_SIZE", 200, 1),
    maxRetries: integer("MAX_RETRIES", 5, 0),
    metricsPort: integer("METRICS_PORT", 9_460, 1),
    submitTransactions: bool("SUBMIT_TRANSACTIONS", false),
    reporterPrivateKey: process.env.REPORTER_PRIVATE_KEY?.trim(),
  };
}
