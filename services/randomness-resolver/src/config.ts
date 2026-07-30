import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export const EXPECTED_CHAIN_ID = 4663n;
export const DEADLINE_SECONDS = 50 * 60;

export type ResolverConfig = {
  host: string;
  port: number;
  verifyingContract: Address;
  account: PrivateKeyAccount;
  apiToken: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function normalizePrivateKey(raw: string): Hex {
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("RESOLVER_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return key;
}

export function loadConfig(): ResolverConfig {
  const verifyingContract = requireEnv("RANDOMNESS_RESOLVER_CONTRACT");
  if (!isAddress(verifyingContract)) {
    throw new Error("RANDOMNESS_RESOLVER_CONTRACT must be a valid address.");
  }

  const host = process.env.HOST?.trim() || "127.0.0.1";
  const portRaw = process.env.PORT?.trim() || "8787";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const apiToken = process.env.RESOLVER_API_TOKEN?.trim() || null;
  const account = privateKeyToAccount(normalizePrivateKey(requireEnv("RESOLVER_PRIVATE_KEY")));

  return {
    host,
    port,
    verifyingContract,
    account,
    apiToken,
  };
}
