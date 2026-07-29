import { isAddress } from "viem";
import {
  countTrackedReferrals,
  findPlayerByWallet,
} from "../../lib/player-registry";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") || "";
  if (!isAddress(wallet)) {
    return Response.json({ error: "Valid wallet required." }, { status: 400 });
  }
  const player = await findPlayerByWallet(wallet);
  const username = player?.gangsterUsername || player?.xUsername;
  const referrals = username ? await countTrackedReferrals(username) : 0;
  return Response.json({
    referrals,
    pointsMultiplier: 1 + referrals * 0.1,
    robberyBonusRate: Math.min(referrals * 0.025, 0.25),
  });
}
