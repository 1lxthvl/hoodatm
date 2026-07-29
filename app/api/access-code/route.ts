import { cookies, headers } from "next/headers";
import { isAddress } from "viem";
import { AccessCodeUnavailable, redeemAccessCode } from "../../lib/access-code-registry";
import { createAccessSession, readAccessSession } from "../../lib/access-session";
import { trackPlayer, updatePlayerCategory } from "../../lib/player-registry";
import { readXSession } from "../../lib/x-session";

export async function POST(request: Request) {
  const secret = process.env.HOODATM_SESSION_SECRET;
  if (!secret) return Response.json({ error: "Access service unavailable." }, { status: 503 });

  const body = await request.json() as { code?: string; wallet?: string };
  if (!body.wallet || !isAddress(body.wallet) || !body.code) {
    return Response.json({ error: "Connect a wallet and enter a valid code." }, { status: 400 });
  }

  try {
    const code = await redeemAccessCode(body.code, body.wallet, "hood-access");
    const requestHeaders = await headers();
    const cookieStore = await cookies();
    const xSession = readXSession(
      cookieStore.get("hoodatm_x_session")?.value,
      secret,
    );
    const player = await trackPlayer({
      wallet: body.wallet,
      ipAddress:
        requestHeaders.get("x-real-ip")
        || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown",
      xUsername: xSession?.username.toLowerCase() ?? null,
      gangsterUsername: null,
      accessCode: code.code,
    });
    await updatePlayerCategory(player.id, "Whitelisted");
    cookieStore.set(
      "hoodatm_access",
      createAccessSession({ wallet: body.wallet.toLowerCase(), codeId: code.id }, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    );
    return Response.json({ access: true, redirectTo: "/create" });
  } catch (error) {
    if (error instanceof AccessCodeUnavailable) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = readAccessSession(
    cookieStore.get("hoodatm_access")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  return session
    ? Response.json({ access: true, wallet: session.wallet })
    : Response.json({ access: false }, { status: 401 });
}
