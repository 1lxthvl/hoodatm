import { randomBytes } from "node:crypto";
import {
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import {
  DEADLINE_SECONDS,
  EXPECTED_CHAIN_ID,
  type ResolverConfig,
} from "./config.js";

export type ResolveRequest = {
  chainId: number | string | bigint;
  account: string;
  contract: string;
  requestId: string;
  commitment: string;
};

export type ResolveResponse = {
  randomWord: string;
  deadline: string;
  signature: Hex;
};

const RESOLUTION_TYPES = {
  Resolution: [
    { name: "consumer", type: "address" },
    { name: "requestId", type: "bytes32" },
    { name: "commitment", type: "bytes32" },
    { name: "randomWord", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export class ResolveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResolveError";
    this.status = status;
  }
}

function parseChainId(value: ResolveRequest["chainId"]): bigint {
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new ResolveError(400, "chainId must be an integer.");
  }
}

function asAddress(value: string, field: string): Address {
  if (!isAddress(value)) {
    throw new ResolveError(400, `${field} must be a valid address.`);
  }
  return value;
}

function asBytes32(value: string, field: string): Hex {
  if (!isHex(value, { strict: true }) || value.length !== 66) {
    throw new ResolveError(400, `${field} must be a 32-byte hex string.`);
  }
  return value;
}

function secureRandomWord(): bigint {
  return BigInt(`0x${randomBytes(32).toString("hex")}`);
}

export async function resolveRandomness(
  config: ResolverConfig,
  body: ResolveRequest,
): Promise<ResolveResponse> {
  const chainId = parseChainId(body.chainId);
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new ResolveError(400, `Unsupported chainId; expected ${EXPECTED_CHAIN_ID}.`);
  }

  // account is accepted for audit/correlation; EIP-712 consumer is the game contract.
  asAddress(body.account, "account");
  const consumer = asAddress(body.contract, "contract");
  const requestId = asBytes32(body.requestId, "requestId");
  const commitment = asBytes32(body.commitment, "commitment");

  const randomWord = secureRandomWord();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  const signature = await signResolution(config.account, config.verifyingContract, {
    consumer,
    requestId,
    commitment,
    randomWord,
    deadline,
  });

  return {
    randomWord: randomWord.toString(10),
    deadline: deadline.toString(10),
    signature,
  };
}

export async function signResolution(
  account: PrivateKeyAccount,
  verifyingContract: Address,
  message: {
    consumer: Address;
    requestId: Hex;
    commitment: Hex;
    randomWord: bigint;
    deadline: bigint;
  },
): Promise<Hex> {
  return account.signTypedData({
    domain: {
      name: "hoodATM RandomnessResolver",
      version: "1",
      chainId: Number(EXPECTED_CHAIN_ID),
      verifyingContract,
    },
    types: RESOLUTION_TYPES,
    primaryType: "Resolution",
    message,
  });
}
