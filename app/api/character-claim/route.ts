import { cookies, headers } from "next/headers";
import { isAddress } from "viem";
import { AccessCodeUnavailable, redeemAccessCode } from "../../lib/access-code-registry";
import {
  addPlayerGangster,
  findPlayerByWallet,
  PlayerRegistryConflict,
  trackPlayer,
} from "../../lib/player-registry";
import { readXSession } from "../../lib/x-session";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") || "";
  if (!isAddress(wallet)) {
    return Response.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const player = await findPlayerByWallet(wallet);
  return Response.json({
    character: player?.characterGrant ?? null,
    earningRate: player?.characterEarningRate ?? null,
    roster: player?.gangsterRoster ?? [],
    slots: player?.gangsterSlots ?? 1,
  });
}

export async function POST(request: Request) {
  const body = await request.json() as { code?: string; wallet?: string };
  if (!body.wallet || !isAddress(body.wallet) || !body.code) {
    return Response.json({ error: "Connect a wallet and enter a valid claim code." }, { status: 400 });
  }
  const existing = await findPlayerByWallet(body.wallet);
  if (existing && existing.gangsterRoster.length >= existing.gangsterSlots) {
    return Response.json(
      { error: "Unlock another gangster slot before claiming this character." },
      { status: 409 },
    );
  }

  try {
    const code = await redeemAccessCode(body.code, body.wallet, "character-claim");
    if (!code.character) throw new AccessCodeUnavailable("Character code is invalid.");
    const requestHeaders = await headers();
    const cookieStore = await cookies();
    const xSession = readXSession(
      cookieStore.get("hoodatm_x_session")?.value,
      process.env.HOODATM_SESSION_SECRET,
    );
    const player = await trackPlayer({
      wallet: body.wallet,
      ipAddress:
        requestHeaders.get("x-real-ip")
        || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown",
      xUsername: xSession?.username.toLowerCase() ?? null,
      gangsterUsername: null,
      characterGrant: code.character,
      characterEarningRate: 50,
      characterCode: code.code,
    });
    const updatedPlayer = existing
      ? await addPlayerGangster(player.id, code.character, code.code)
      : player;
    return Response.json({
      claimed: true,
      character: code.character,
      earningRate: 50,
      roster: updatedPlayer?.gangsterRoster ?? [],
      slots: updatedPlayer?.gangsterSlots ?? 1,
    });
  } catch (error) {
    if (error instanceof AccessCodeUnavailable || error instanceof PlayerRegistryConflict) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
