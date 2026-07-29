import { headers } from "next/headers";
import { isAddress } from "viem";
import {
  findPlayerByWallet,
  trackPlayer,
  unlockPlayerGangsterSlot,
} from "../../lib/player-registry";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") || "";
  if (!isAddress(wallet)) {
    return Response.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const player = await findPlayerByWallet(wallet);
  return Response.json({
    slots: player?.gangsterSlots ?? 1,
    roster: player?.gangsterRoster ?? [],
  });
}

export async function POST(request: Request) {
  const body = await request.json() as { wallet?: string; expectedSlots?: number };
  if (!body.wallet || !isAddress(body.wallet)) {
    return Response.json({ error: "Connect the wallet that owns this account." }, { status: 400 });
  }
  if (process.env.NEXT_PUBLIC_GAME_LIVE === "true") {
    return Response.json(
      { error: "Live slot unlocks require a confirmed $GANGSTER payment transaction." },
      { status: 409 },
    );
  }

  let player = await findPlayerByWallet(body.wallet);
  if (!player) {
    const requestHeaders = await headers();
    player = await trackPlayer({
      wallet: body.wallet,
      ipAddress:
        requestHeaders.get("x-real-ip")
        || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown",
      xUsername: null,
      gangsterUsername: null,
    });
  }
  if (body.expectedSlots !== player.gangsterSlots) {
    return Response.json(
      { error: "Crew slot state changed. Refresh and try again." },
      { status: 409 },
    );
  }
  const updated = await unlockPlayerGangsterSlot(body.wallet);
  return Response.json({
    slots: updated?.gangsterSlots ?? player.gangsterSlots,
    roster: updated?.gangsterRoster ?? player.gangsterRoster,
  });
}
