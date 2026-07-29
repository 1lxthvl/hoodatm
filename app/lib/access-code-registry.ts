import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { gangsterCharacters, type GangsterCharacter } from "./player-registry";

export type AccessCodeType = "hood-access" | "character-claim";

export type AccessCodeRecord = {
  id: string;
  code: string;
  createdAt: string;
  createdBy: string;
  type: AccessCodeType;
  character: GangsterCharacter | null;
  usedAt: string | null;
  usedByWallet: string | null;
};

export class AccessCodeUnavailable extends Error {}

const accessCodePath =
  process.env.HOODATM_ACCESS_CODE_LOG_PATH || ".data/access-codes.json";
let accessCodeQueue: Promise<unknown> = Promise.resolve();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

async function readCodesUnsafe(): Promise<AccessCodeRecord[]> {
  try {
    return JSON.parse(
      await readFile(/* turbopackIgnore: true */ accessCodePath, "utf8"),
    ) as AccessCodeRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeCodesUnsafe(codes: AccessCodeRecord[]) {
  if (!process.env.HOODATM_ACCESS_CODE_LOG_PATH) {
    await mkdir(".data", { recursive: true });
  }
  const temporaryPath = `${accessCodePath}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporaryPath,
    JSON.stringify(codes, null, 2),
    "utf8",
  );
  await rename(
    /* turbopackIgnore: true */ temporaryPath,
    /* turbopackIgnore: true */ accessCodePath,
  );
}

export async function listAccessCodes() {
  await accessCodeQueue;
  return (await readCodesUnsafe()).map((record) => ({
    ...record,
    type: record.type || "hood-access",
    character: record.character || null,
  }));
}

export async function generateAccessCode(
  createdBy: string,
  type: AccessCodeType,
  character: GangsterCharacter | null,
) {
  if (
    (type === "character-claim" && (!character || !gangsterCharacters.includes(character)))
    || (type === "hood-access" && character)
  ) {
    throw new AccessCodeUnavailable("Invalid code configuration.");
  }
  const operation = accessCodeQueue.then(async () => {
    const codes = await readCodesUnsafe();
    let code = "";
    do {
      code = `${type === "character-claim" ? "CLAIM" : "HOOD"}-${randomSegment(4)}-${randomSegment(4)}`;
    } while (codes.some((record) => record.code === code));
    const record: AccessCodeRecord = {
      id: randomUUID(),
      code,
      createdAt: new Date().toISOString(),
      createdBy,
      type,
      character,
      usedAt: null,
      usedByWallet: null,
    };
    codes.unshift(record);
    await writeCodesUnsafe(codes);
    return record;
  });
  accessCodeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function redeemAccessCode(
  value: unknown,
  wallet: string,
  expectedType: AccessCodeType,
) {
  const operation = accessCodeQueue.then(async () => {
    const codes = await readCodesUnsafe();
    const code = normalizeCode(value);
    const record = codes.find((candidate) => candidate.code === code);
    const recordType = record?.type || "hood-access";
    if (!record || record.usedAt || recordType !== expectedType) {
      throw new AccessCodeUnavailable("Code invalid or already used.");
    }
    record.usedAt = new Date().toISOString();
    record.usedByWallet = wallet.toLowerCase();
    await writeCodesUnsafe(codes);
    return record;
  });
  accessCodeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
