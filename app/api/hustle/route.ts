import { cookies, headers } from "next/headers";
import { isAddress } from "viem";
import {
  claimPlayerHustleEarnings,
  findPlayerByWallet,
  getHustleAtmPoolTotals,
  listTrackedPlayers,
  PlayerRegistryConflict,
  trackPlayer,
  updatePlayerHustle,
  type GangsterCharacter,
  type TrackedPlayer,
} from "../../lib/player-registry";
import { CLAIM_COOLDOWN_MS, getClaimTerms } from "../../lib/claim-economy";
import { readXSession } from "../../lib/x-session";
import { GET as getGangsterPrice } from "../gangster-price/route";

const DAILY_FARM_POOL_USD = 580;
const characterPower: Record<GangsterCharacter, number> = {
  Hoodlum: 5,
  Captain: 30,
  General: 135,
  OG: 750,
};

function farmingProfile(player: TrackedPlayer) {
  if (player.gangsterRoster.length === 0) {
    return { power: 1, weight: 1.5, earningRate: 1 };
  }
  const power = player.gangsterRoster.reduce(
    (total, gangster) => total + characterPower[gangster.character],
    0,
  );
  const weightedRate = player.gangsterRoster.reduce(
    (total, gangster) => (
      total + characterPower[gangster.character] * gangster.earningRate
    ),
    0,
  ) / Math.max(1, power) / 100;
  const primary = [...player.gangsterRoster].sort(
    (left, right) => characterPower[right.character] - characterPower[left.character],
  )[0];
  const balanceMultiplier = primary.character === "Hoodlum"
    ? 1.5
    : primary.character === "General"
      ? 0.63
      : primary.character === "OG"
        ? 0.8
        : 1;
  return { power, weight: power * balanceMultiplier, earningRate: weightedRate };
}

async function zeroHeatRate(player: TrackedPlayer) {
  const response = await getGangsterPrice();
  if (!response.ok) return 0;
  const price = await response.json() as { gangsterUsd?: number };
  if (!price.gangsterUsd || price.gangsterUsd <= 0) return 0;
  const players = await listTrackedPlayers();
  const totalWeight = players.reduce(
    (total, candidate) => total + farmingProfile(candidate).weight,
    0,
  );
  const profile = farmingProfile(player);
  const share = totalWeight > 0 ? profile.weight / totalWeight : 1;
  return (DAILY_FARM_POOL_USD / price.gangsterUsd / 24) * share * profile.earningRate;
}

function hustleState(
  player: TrackedPlayer | null,
  atmPoolContributions: [number, number, number, number],
) {
  const now = Date.now();
  const unclaimedSince = player?.hustleUnclaimedSince
    ? new Date(player.hustleUnclaimedSince).getTime()
    : null;
  const lastClaimAt = player?.hustleLastClaimAt
    ? new Date(player.hustleLastClaimAt).getTime()
    : null;
  const claimTerms = getClaimTerms(unclaimedSince, now);
  return {
    hustling: player?.hustling ?? false,
    startedAt: player?.hustleStartedAt ?? null,
    accumulatedMs: player?.hustleAccumulatedMs ?? 0,
    earned: player?.hustleEarned ?? 0,
    unclaimed: player?.hustleUnclaimed ?? 0,
    claimed: player?.hustleClaimed ?? 0,
    heat: player?.hustleHeat ?? 0,
    unclaimedSince,
    lastClaimAt,
    nextClaimAt: lastClaimAt ? lastClaimAt + CLAIM_COOLDOWN_MS : 0,
    claimFeeBps: claimTerms.feeBps,
    claimBonusBps: claimTerms.bonusBps,
    claimHeldHours: claimTerms.heldHours,
    atmPoolContributions,
    serverTime: now,
  };
}

async function ensurePlayer(wallet: string) {
  const existing = await findPlayerByWallet(wallet);
  if (existing) return existing;

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const xSession = readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  return trackPlayer({
    wallet,
    ipAddress:
      requestHeaders.get("x-real-ip")
      || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown",
    xUsername: xSession?.username.toLowerCase() ?? null,
    gangsterUsername: null,
  });
}

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") || "";
  if (!isAddress(wallet)) {
    return Response.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const player = await findPlayerByWallet(wallet);
  if (!player) {
    return Response.json(hustleState(null, await getHustleAtmPoolTotals()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const settled = await updatePlayerHustle(wallet, "sync", await zeroHeatRate(player));
  return Response.json(hustleState(settled, await getHustleAtmPoolTotals()), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    wallet?: string;
    action?: "start" | "pause" | "sync" | "claim";
  };
  if (!body.wallet || !isAddress(body.wallet)) {
    return Response.json({ error: "Valid wallet required." }, { status: 400 });
  }
  if (
    body.action !== "start"
    && body.action !== "pause"
    && body.action !== "sync"
    && body.action !== "claim"
  ) {
    return Response.json({ error: "Valid hustle action required." }, { status: 400 });
  }

  const ensured = await ensurePlayer(body.wallet);
  if (body.action === "claim") {
    try {
      await updatePlayerHustle(
        body.wallet,
        "sync",
        await zeroHeatRate(ensured),
      );
      const result = await claimPlayerHustleEarnings(body.wallet);
      return Response.json({
        ...hustleState(result?.player ?? null, await getHustleAtmPoolTotals()),
        claim: result?.claim,
      });
    } catch (error) {
      if (error instanceof PlayerRegistryConflict) {
        return Response.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }
  const player = await updatePlayerHustle(
    body.wallet,
    body.action,
    body.action === "start" ? 0 : await zeroHeatRate(ensured),
  );
  return Response.json(hustleState(player, await getHustleAtmPoolTotals()));
}
