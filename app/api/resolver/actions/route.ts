import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isAddress, isHex } from "viem";

type PendingResolverAction = {
  requestId: `0x${string}`;
  account: `0x${string}`;
  contract: `0x${string}`;
  commitment: `0x${string}`;
  state: "pending" | "ready";
  createdAt: string;
  updatedAt: string;
  response?: {
    randomWord: string;
    deadline: string;
    signature: `0x${string}`;
  };
};

const statePath =
  process.env.HOODATM_RESOLVER_STATE_PATH || ".data/resolver-actions.json";
let queue: Promise<unknown> = Promise.resolve();

async function readActions(): Promise<PendingResolverAction[]> {
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ statePath, "utf8")) as PendingResolverAction[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeActions(actions: PendingResolverAction[]) {
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporaryPath,
    JSON.stringify(actions, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  await rename(
    /* turbopackIgnore: true */ temporaryPath,
    /* turbopackIgnore: true */ statePath,
  );
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<PendingResolverAction>;
  if (
    !body.account
    || !body.contract
    || !body.requestId
    || !body.commitment
    || !isAddress(body.account)
    || !isAddress(body.contract)
    || !isHex(body.requestId, { strict: true })
    || !isHex(body.commitment, { strict: true })
    || body.requestId.length !== 66
    || body.commitment.length !== 66
  ) {
    return Response.json({ error: "Valid resolver action required." }, { status: 400 });
  }
  const allowedContracts = [
    process.env.NEXT_PUBLIC_HOODATM_GAME_ADDRESS,
    process.env.NEXT_PUBLIC_HOODATM_GANG_ADDRESS,
  ].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  if (!allowedContracts.includes(body.contract.toLowerCase())) {
    return Response.json({ error: "Resolver consumer is not configured." }, { status: 403 });
  }

  const operation = queue.then(async () => {
    const pendingCutoff = Date.now() - 2 * 60 * 60 * 1000;
    const readyCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const actions = (await readActions()).filter(
      (action) => Date.parse(action.updatedAt) >= (
        action.state === "ready" ? readyCutoff : pendingCutoff
      ),
    );
    const existing = actions.find((action) => action.requestId === body.requestId);
    if (
      existing
      && (
        existing.account.toLowerCase() !== body.account?.toLowerCase()
        || existing.contract.toLowerCase() !== body.contract?.toLowerCase()
        || existing.commitment !== body.commitment
      )
    ) {
      throw new Error("Resolver request ID metadata conflict.");
    }
    if (existing?.state === "ready") return existing.response;

    const now = new Date().toISOString();
    if (!existing) {
      actions.push({
        requestId: body.requestId!,
        account: body.account!,
        contract: body.contract!,
        commitment: body.commitment!,
        state: "pending",
        createdAt: now,
        updatedAt: now,
      });
      await writeActions(actions);
    }

    const resolverUrl = process.env.HOODATM_RESOLVER_URL;
    if (!resolverUrl) {
      return null;
    }
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (process.env.HOODATM_RESOLVER_API_TOKEN) {
      headers.Authorization = `Bearer ${process.env.HOODATM_RESOLVER_API_TOKEN}`;
    }
    const response = await fetch(resolverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chainId: 4663,
        account: body.account,
        contract: body.contract,
        requestId: body.requestId,
        commitment: body.commitment,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const resolved = await response.json() as {
      randomWord?: string;
      deadline?: string;
      signature?: `0x${string}`;
    };
    if (
      !resolved.randomWord
      || !resolved.deadline
      || !resolved.signature
      || !isHex(resolved.signature, { strict: true })
    ) return null;

    const current = actions.find((action) => action.requestId === body.requestId);
    if (current) {
      current.state = "ready";
      current.updatedAt = new Date().toISOString();
      current.response = {
        randomWord: resolved.randomWord,
        deadline: resolved.deadline,
        signature: resolved.signature,
      };
      await writeActions(actions);
    }
    return current?.response ?? null;
  });
  queue = operation.then(() => undefined, () => undefined);

  const result = await operation;
  if (!result) {
    return Response.json(
      { pending: true, retryAfterSeconds: 20 },
      { status: 202, headers: { "Retry-After": "20" } },
    );
  }
  return Response.json({ pending: false, ...result });
}
