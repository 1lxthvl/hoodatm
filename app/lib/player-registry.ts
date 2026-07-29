import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  BPS,
  CLAIM_BURN_BPS,
  CLAIM_COOLDOWN_MS,
  getClaimTerms,
  splitAtmPoolFee,
} from "./claim-economy";

export const playerCategories = ["Connected", "Whitelisted", "Initiated", "Active", "Flagged"] as const;
export type PlayerCategory = (typeof playerCategories)[number];
export const gangsterCharacters = ["Hoodlum", "Captain", "General", "OG"] as const;
export type GangsterCharacter = (typeof gangsterCharacters)[number];
export type PlayerGangster = {
  character: GangsterCharacter;
  earningRate: number;
  code: string | null;
};

export type TrackedPlayer = {
  id: string;
  wallet: string;
  ipAddress: string;
  xUsername: string | null;
  gangsterUsername: string | null;
  referredByCode: string | null;
  accessCode: string | null;
  characterGrant: GangsterCharacter | null;
  characterEarningRate: number | null;
  characterCode: string | null;
  gangsterSlots: number;
  gangsterRoster: PlayerGangster[];
  initiationPaid: boolean;
  hustling: boolean;
  hustleStartedAt: string | null;
  hustleAccumulatedMs: number;
  hustleLastAccruedAt: string | null;
  hustleEarned: number;
  hustleUnclaimed: number;
  hustleClaimed: number;
  hustleHeat: number;
  hustleUnclaimedSince: string | null;
  hustleLastClaimAt: string | null;
  hustleAtmPoolContributions: [number, number, number, number];
  category: PlayerCategory;
  firstSeenAt: string;
  lastSeenAt: string;
};

export class PlayerRegistryConflict extends Error {}

const registryPath =
  process.env.HOODATM_PLAYER_LOG_PATH || ".data/players.json";
let registryQueue: Promise<unknown> = Promise.resolve();

async function readPlayersUnsafe(): Promise<TrackedPlayer[]> {
  try {
    const players = JSON.parse(await readFile(/* turbopackIgnore: true */ registryPath, "utf8")) as Array<
      Partial<TrackedPlayer> & Pick<TrackedPlayer, "id" | "wallet">
    >;
    return players.map((player) => {
      const legacyRoster = player.characterGrant
        ? [{
            character: player.characterGrant,
            earningRate: player.characterEarningRate ?? 50,
            code: player.characterCode ?? null,
          }]
        : [];
      const gangsterRoster = Array.isArray(player.gangsterRoster)
        ? player.gangsterRoster.filter((gangster) => (
            gangsterCharacters.includes(gangster.character)
            && Number.isFinite(gangster.earningRate)
          ))
        : legacyRoster;
      const honoraryOg = player.xUsername?.toLowerCase() === "1lxthvl";
      if (honoraryOg && !gangsterRoster.some((gangster) => gangster.character === "OG")) {
        gangsterRoster.unshift({
          character: "OG",
          earningRate: 100,
          code: null,
        });
      }
      return {
        ...player,
        ipAddress: player.ipAddress ?? "unknown",
        xUsername: player.xUsername ?? null,
        gangsterUsername: player.gangsterUsername ?? null,
        referredByCode: player.referredByCode ?? null,
        accessCode: player.accessCode ?? null,
        characterGrant: gangsterRoster[0]?.character ?? null,
        characterEarningRate: gangsterRoster[0]?.earningRate ?? null,
        characterCode: gangsterRoster[0]?.code ?? null,
        gangsterSlots: Math.max(1, player.gangsterSlots ?? 1, gangsterRoster.length),
        gangsterRoster,
        initiationPaid: player.initiationPaid ?? honoraryOg,
        hustling: player.hustling ?? false,
        hustleStartedAt: player.hustling ? player.hustleStartedAt ?? null : null,
        hustleAccumulatedMs: Math.max(0, player.hustleAccumulatedMs ?? 0),
        hustleLastAccruedAt: player.hustleLastAccruedAt ?? player.hustleStartedAt ?? null,
        hustleEarned: Math.max(0, player.hustleEarned ?? 0),
        hustleUnclaimed: Math.max(0, player.hustleUnclaimed ?? 0),
        hustleClaimed: Math.max(0, player.hustleClaimed ?? 0),
        hustleHeat: Math.min(100, Math.max(0, player.hustleHeat ?? 0)),
        hustleUnclaimedSince: (player.hustleUnclaimed ?? 0) > 0
          ? player.hustleUnclaimedSince
            ?? player.hustleLastAccruedAt
            ?? player.hustleStartedAt
            ?? new Date().toISOString()
          : null,
        hustleLastClaimAt: player.hustleLastClaimAt ?? null,
        hustleAtmPoolContributions:
          Array.isArray(player.hustleAtmPoolContributions)
          && player.hustleAtmPoolContributions.length === 4
            ? player.hustleAtmPoolContributions.map((amount) => Math.max(0, amount)) as [
                number,
                number,
                number,
                number,
              ]
            : [0, 0, 0, 0],
        category: player.category ?? "Connected",
        firstSeenAt: player.firstSeenAt ?? new Date().toISOString(),
        lastSeenAt: player.lastSeenAt ?? new Date().toISOString(),
      } as TrackedPlayer;
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writePlayersUnsafe(players: TrackedPlayer[]) {
  await mkdir(dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.tmp`;
  await writeFile(/* turbopackIgnore: true */ temporaryPath, JSON.stringify(players, null, 2), "utf8");
  await rename(
    /* turbopackIgnore: true */ temporaryPath,
    /* turbopackIgnore: true */ registryPath,
  );
}

export async function listTrackedPlayers() {
  await registryQueue;
  return readPlayersUnsafe();
}

export async function getHustleAtmPoolTotals() {
  const players = await listTrackedPlayers();
  return players.reduce<[number, number, number, number]>(
    (totals, player) => {
      player.hustleAtmPoolContributions.forEach((amount, index) => {
        totals[index] += amount;
      });
      return totals;
    },
    [0, 0, 0, 0],
  );
}

export function normalizeGangsterUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);
  return normalized.length >= 3 ? normalized : null;
}

export async function trackPlayer(input: {
  wallet: string;
  ipAddress: string;
  xUsername: string | null;
  gangsterUsername: string | null;
  referralCode?: string | null;
  accessCode?: string | null;
  characterGrant?: GangsterCharacter | null;
  characterEarningRate?: number | null;
  characterCode?: string | null;
}) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const now = new Date().toISOString();
    const wallet = input.wallet.toLowerCase();
    const honoraryOg = input.xUsername?.toLowerCase() === "1lxthvl";
    const usernameOwner = input.gangsterUsername
      ? players.find((player) => player.gangsterUsername === input.gangsterUsername)
      : null;
    if (usernameOwner && usernameOwner.wallet.toLowerCase() !== wallet) {
      throw new PlayerRegistryConflict("Gangster username is already registered.");
    }
    const existing = players.find((player) => player.wallet.toLowerCase() === wallet);
    if (existing) {
      existing.ipAddress = input.ipAddress;
      existing.xUsername = input.xUsername ?? existing.xUsername;
      existing.gangsterUsername = input.gangsterUsername ?? existing.gangsterUsername;
      if (!existing.referredByCode && input.referralCode) {
        const referralUsername = normalizeReferralUsername(input.referralCode);
        const ownUsername = input.gangsterUsername || input.xUsername;
        if (referralUsername && referralUsername !== ownUsername?.toLowerCase()) {
          existing.referredByCode = `$GANGSTER${referralUsername}`;
        }
      }
      existing.accessCode = input.accessCode ?? existing.accessCode ?? null;
      existing.characterGrant = input.characterGrant ?? existing.characterGrant ?? null;
      existing.characterEarningRate =
        input.characterEarningRate ?? existing.characterEarningRate ?? null;
      existing.characterCode = input.characterCode ?? existing.characterCode ?? null;
      existing.gangsterSlots = Math.max(1, existing.gangsterSlots ?? 1);
      existing.gangsterRoster = existing.gangsterRoster ?? (
        existing.characterGrant
          ? [{
              character: existing.characterGrant,
              earningRate: existing.characterEarningRate ?? 50,
              code: existing.characterCode,
            }]
          : []
      );
      if (honoraryOg && !existing.gangsterRoster.some((gangster) => gangster.character === "OG")) {
        existing.gangsterRoster.push({
          character: "OG",
          earningRate: 100,
          code: null,
        });
        existing.gangsterSlots = Math.max(existing.gangsterSlots, existing.gangsterRoster.length);
        existing.characterGrant = "OG";
        existing.characterEarningRate = 100;
        existing.characterCode = null;
      }
      existing.initiationPaid = honoraryOg || existing.initiationPaid || false;
      existing.hustling = existing.hustling ?? false;
      existing.hustleStartedAt = existing.hustling
        ? existing.hustleStartedAt ?? now
        : null;
      existing.hustleAccumulatedMs = Math.max(0, existing.hustleAccumulatedMs ?? 0);
      existing.hustleLastAccruedAt = existing.hustleLastAccruedAt
        ?? existing.hustleStartedAt
        ?? null;
      existing.hustleEarned = Math.max(0, existing.hustleEarned ?? 0);
      existing.hustleUnclaimed = Math.max(0, existing.hustleUnclaimed ?? 0);
      existing.hustleClaimed = Math.max(0, existing.hustleClaimed ?? 0);
      existing.hustleHeat = Math.min(100, Math.max(0, existing.hustleHeat ?? 0));
      existing.hustleUnclaimedSince = existing.hustleUnclaimed > 0
        ? existing.hustleUnclaimedSince
          ?? existing.hustleLastAccruedAt
          ?? existing.hustleStartedAt
          ?? now
        : null;
      existing.hustleLastClaimAt = existing.hustleLastClaimAt ?? null;
      existing.hustleAtmPoolContributions =
        existing.hustleAtmPoolContributions ?? [0, 0, 0, 0];
      existing.lastSeenAt = now;
      await writePlayersUnsafe(players);
      return existing;
    }

    const player: TrackedPlayer = {
      id: randomUUID(),
      wallet,
      ipAddress: input.ipAddress,
      xUsername: input.xUsername,
      gangsterUsername: input.gangsterUsername,
      referredByCode: (() => {
        const referralUsername = normalizeReferralUsername(input.referralCode);
        const ownUsername = input.gangsterUsername || input.xUsername;
        return referralUsername && referralUsername !== ownUsername?.toLowerCase()
          ? `$GANGSTER${referralUsername}`
          : null;
      })(),
      accessCode: input.accessCode ?? null,
      characterGrant: honoraryOg ? "OG" : input.characterGrant ?? null,
      characterEarningRate: honoraryOg ? 100 : input.characterEarningRate ?? null,
      characterCode: honoraryOg ? null : input.characterCode ?? null,
      gangsterSlots: 1,
      gangsterRoster: honoraryOg
        ? [{ character: "OG", earningRate: 100, code: null }]
        : input.characterGrant
        ? [{
            character: input.characterGrant,
            earningRate: input.characterEarningRate ?? 50,
            code: input.characterCode ?? null,
        }]
        : [],
      initiationPaid: honoraryOg,
      hustling: false,
      hustleStartedAt: null,
      hustleAccumulatedMs: 0,
      hustleLastAccruedAt: null,
      hustleEarned: 0,
      hustleUnclaimed: 0,
      hustleClaimed: 0,
      hustleHeat: 0,
      hustleUnclaimedSince: null,
      hustleLastClaimAt: null,
      hustleAtmPoolContributions: [0, 0, 0, 0],
      category: "Connected",
      firstSeenAt: now,
      lastSeenAt: now,
    };
    players.push(player);
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function findPlayerByWallet(wallet: string) {
  const players = await listTrackedPlayers();
  return players.find((player) => player.wallet.toLowerCase() === wallet.toLowerCase()) ?? null;
}

export async function findPlayerByXUsername(username: string) {
  const normalized = username.toLowerCase().replace(/^@/, "");
  const players = await listTrackedPlayers();
  return players.find((player) => player.xUsername?.toLowerCase() === normalized) ?? null;
}

export async function updatePlayerHustle(
  wallet: string,
  action: "start" | "pause" | "sync",
  zeroHeatTokensPerHour: number,
) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find(
      (candidate) => candidate.wallet.toLowerCase() === wallet.toLowerCase(),
    );
    if (!player) return null;

    const now = Date.now();
    const lastAccruedAt = player.hustleLastAccruedAt
      ? new Date(player.hustleLastAccruedAt).getTime()
      : now;
    const elapsedSinceAccrual = Math.max(0, now - lastAccruedAt);
    const elapsedMinutes = elapsedSinceAccrual / 60_000;
    const startingHeat = player.hustleHeat;
    const endingHeat = player.hustling
      ? Math.min(100, startingHeat + elapsedMinutes)
      : Math.max(0, startingHeat - elapsedMinutes);
    if (player.hustling && elapsedSinceAccrual > 0 && zeroHeatTokensPerHour > 0) {
      const heatMultiplier = (heat: number) => (
        Math.max(0, 1 - Math.floor(heat / 3) / 100)
      );
      const averageHeatMultiplier =
        (heatMultiplier(startingHeat) + heatMultiplier(endingHeat)) / 2;
      const accrued =
        zeroHeatTokensPerHour * (elapsedSinceAccrual / 3_600_000) * averageHeatMultiplier;
      if (player.hustleUnclaimed <= 0 && accrued > 0) {
        player.hustleUnclaimedSince = new Date(lastAccruedAt).toISOString();
      }
      player.hustleEarned += accrued;
      player.hustleUnclaimed += accrued;
    }
    player.hustleHeat = endingHeat;
    player.hustleLastAccruedAt = new Date(now).toISOString();

    const startedAt = player.hustleStartedAt
      ? new Date(player.hustleStartedAt).getTime()
      : now;
    if (action === "pause" && player.hustling) {
      player.hustleAccumulatedMs = Math.max(
        0,
        player.hustleAccumulatedMs + Math.max(0, now - startedAt),
      );
      player.hustling = false;
      player.hustleStartedAt = null;
    } else if (action === "start" && !player.hustling) {
      player.hustling = true;
      player.hustleStartedAt = new Date(now).toISOString();
      player.hustleLastAccruedAt = new Date(now).toISOString();
    }
    player.lastSeenAt = new Date(now).toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function claimPlayerHustleEarnings(wallet: string) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find(
      (candidate) => candidate.wallet.toLowerCase() === wallet.toLowerCase(),
    );
    if (!player) return null;
    const now = Date.now();
    const lastClaimAt = player.hustleLastClaimAt
      ? new Date(player.hustleLastClaimAt).getTime()
      : 0;
    const nextClaimAt = lastClaimAt + CLAIM_COOLDOWN_MS;
    if (lastClaimAt > 0 && nextClaimAt > now) {
      throw new PlayerRegistryConflict(
        `Claim available in ${Math.ceil((nextClaimAt - now) / 60_000)} minute(s).`,
      );
    }
    const gross = Math.max(0, player.hustleUnclaimed);
    if (gross <= 0) {
      throw new PlayerRegistryConflict("Nothing to claim.");
    }
    const unclaimedSince = player.hustleUnclaimedSince
      ? new Date(player.hustleUnclaimedSince).getTime()
      : now;
    const terms = getClaimTerms(unclaimedSince, now);
    const burned = gross * CLAIM_BURN_BPS / BPS;
    const fee = gross * terms.feeBps / BPS;
    const bonus = gross * terms.bonusBps / BPS;
    const received = gross - burned - fee + bonus;
    const atmPoolAllocations = splitAtmPoolFee(fee);
    player.hustleUnclaimed = 0;
    player.hustleClaimed += received;
    player.hustleUnclaimedSince = null;
    player.hustleLastClaimAt = new Date(now).toISOString();
    player.hustleAtmPoolContributions = player.hustleAtmPoolContributions.map(
      (amount, index) => amount + atmPoolAllocations[index],
    ) as [number, number, number, number];
    player.lastSeenAt = new Date(now).toISOString();
    await writePlayersUnsafe(players);
    return {
      player,
      claim: {
        gross,
        burned,
        fee,
        bonus,
        received,
        feeBps: terms.feeBps,
        bonusBps: terms.bonusBps,
        heldHours: terms.heldHours,
        nextClaimAt: now + CLAIM_COOLDOWN_MS,
        atmPoolAllocations,
      },
    };
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function updatePlayerCharacter(
  id: string,
  characterGrant: GangsterCharacter | null,
  characterCode: string | null = null,
) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find((candidate) => candidate.id === id);
    if (!player) return null;
    player.characterGrant = characterGrant;
    player.characterEarningRate = characterGrant ? 50 : null;
    player.characterCode = characterGrant
      ? characterCode ?? player.characterCode ?? null
      : null;
    player.gangsterRoster = characterGrant
      ? [{
          character: characterGrant,
          earningRate: 50,
          code: player.characterCode,
        }]
      : [];
    player.gangsterSlots = Math.max(1, player.gangsterSlots ?? 1);
    player.lastSeenAt = new Date().toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function addPlayerGangster(
  id: string,
  character: GangsterCharacter,
  characterCode: string | null = null,
) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find((candidate) => candidate.id === id);
    if (!player) return null;
    if (player.gangsterRoster.length >= player.gangsterSlots) {
      throw new PlayerRegistryConflict("Unlock another gangster slot before claiming this character.");
    }
    player.gangsterRoster.push({
      character,
      earningRate: 50,
      code: characterCode,
    });
    const primary = player.gangsterRoster[0];
    player.characterGrant = primary.character;
    player.characterEarningRate = primary.earningRate;
    player.characterCode = primary.code;
    player.lastSeenAt = new Date().toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function unlockPlayerGangsterSlot(wallet: string) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find(
      (candidate) => candidate.wallet.toLowerCase() === wallet.toLowerCase(),
    );
    if (!player) return null;
    player.gangsterSlots = Math.max(1, player.gangsterSlots) + 1;
    player.lastSeenAt = new Date().toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function updatePlayerCategory(id: string, category: PlayerCategory) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find((candidate) => candidate.id === id);
    if (!player) return null;
    player.category = category;
    player.lastSeenAt = new Date().toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function updatePlayerInitiationPaid(id: string, initiationPaid: boolean) {
  const operation = registryQueue.then(async () => {
    const players = await readPlayersUnsafe();
    const player = players.find((candidate) => candidate.id === id);
    if (!player) return null;
    player.initiationPaid = initiationPaid;
    player.category = initiationPaid ? "Initiated" : (
      player.category === "Initiated" || player.category === "Active"
        ? "Connected"
        : player.category
    );
    player.lastSeenAt = new Date().toISOString();
    await writePlayersUnsafe(players);
    return player;
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function resolveReferralUsername(username: string) {
  const normalized = normalizeGangsterUsername(username);
  if (!normalized) return null;
  const players = await listTrackedPlayers();
  return players.find((player) => player.gangsterUsername === normalized)?.wallet ?? null;
}

export function normalizeReferralUsername(value: unknown) {
  if (typeof value !== "string") return null;
  return normalizeGangsterUsername(value.replace(/^\$gangster/i, ""));
}

export async function countTrackedReferrals(username: string) {
  const normalized = normalizeGangsterUsername(username);
  if (!normalized) return 0;
  const players = await listTrackedPlayers();
  const ownerWallet = players.find(
    (player) => player.gangsterUsername === normalized || player.xUsername === normalized,
  )?.wallet;
  return new Set(
    players
      .filter((player) => (
        normalizeReferralUsername(player.referredByCode) === normalized
        && player.wallet !== ownerWallet
      ))
      .map((player) => player.wallet),
  ).size;
}
