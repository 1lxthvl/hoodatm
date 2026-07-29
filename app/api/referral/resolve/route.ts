import { resolveReferralUsername } from "../../../lib/player-registry";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  const username = code.replace(/^\$gangster/i, "");
  const wallet = await resolveReferralUsername(username);
  return wallet
    ? Response.json({ wallet })
    : Response.json({ error: "Referral code not registered" }, { status: 404 });
}
