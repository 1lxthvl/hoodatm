import { cookies, headers } from "next/headers";
import { isAddress } from "viem";
import { isAdminUsername } from "../../../lib/admin-access";
import { markCodeGrantedOnChain } from "../../../lib/onchain-code-grant";
import { readXSession } from "../../../lib/x-session";
import {
  listTrackedPlayers,
  normalizeGangsterUsername,
  PlayerRegistryConflict,
  gangsterCharacters,
  playerCategories,
  trackPlayer,
  updatePlayerCharacter,
  updatePlayerCategory,
  updatePlayerInitiationPaid,
  type GangsterCharacter,
} from "../../../lib/player-registry";

async function session() {
  const cookieStore = await cookies();
  return readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
}

async function isAdmin() {
  return isAdminUsername((await session())?.username);
}

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(
    { players: await listTrackedPlayers() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const body = await request.json() as {
    wallet?: string;
    gangsterUsername?: string;
    referralCode?: string;
  };
  if (!body.wallet || !isAddress(body.wallet)) {
    return Response.json({ error: "Valid wallet required" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const xSession = await session();
  const ipAddress =
    requestHeaders.get("x-real-ip")
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  try {
    const player = await trackPlayer({
      wallet: body.wallet,
      ipAddress,
      xUsername: xSession?.username.toLowerCase() ?? null,
      gangsterUsername: normalizeGangsterUsername(body.gangsterUsername),
      referralCode: body.referralCode ?? null,
    });
    return Response.json({ tracked: true, id: player.id });
  } catch (error) {
    if (error instanceof PlayerRegistryConflict) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as {
    id?: string;
    category?: string;
    characterGrant?: GangsterCharacter | null;
    initiationPaid?: boolean;
  };
  if (!body.id) return Response.json({ error: "Player id required" }, { status: 400 });

  if (typeof body.initiationPaid === "boolean") {
    const player = await updatePlayerInitiationPaid(body.id, body.initiationPaid);
    return player
      ? Response.json({ player })
      : Response.json({ error: "Player not found" }, { status: 404 });
  }

  if (Object.prototype.hasOwnProperty.call(body, "characterGrant")) {
    if (
      body.characterGrant !== null
      && !gangsterCharacters.includes(body.characterGrant as GangsterCharacter)
    ) {
      return Response.json({ error: "Invalid gangster character" }, { status: 400 });
    }
    const player = await updatePlayerCharacter(body.id, body.characterGrant ?? null);
    if (!player) return Response.json({ error: "Player not found" }, { status: 404 });
    let onchainGrant: Awaited<ReturnType<typeof markCodeGrantedOnChain>> | null = null;
    if (player.wallet && body.characterGrant) {
      try {
        onchainGrant = await markCodeGrantedOnChain(
          player.wallet,
          body.characterGrant as GangsterCharacter,
        );
      } catch (error) {
        onchainGrant = {
          skipped: true,
          reason: error instanceof Error ? error.message : "onchain-grant-failed",
        };
      }
    }
    return Response.json({ player, onchainGrant });
  }

  if (
    !body.category
    || !playerCategories.includes(body.category as (typeof playerCategories)[number])
  ) {
    return Response.json({ error: "Invalid category update" }, { status: 400 });
  }
  const player = await updatePlayerCategory(
    body.id,
    body.category as (typeof playerCategories)[number],
  );
  return player
    ? Response.json({ player })
    : Response.json({ error: "Player not found" }, { status: 404 });
}
