import { cookies } from "next/headers";
import { readXSession } from "../../../lib/x-session";
import {
  verifyXQuest,
  XQuestCooldown,
  XVerificationUnavailable,
  type XQuest,
} from "../../../lib/x-quest-registry";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  if (!session) {
    return Response.json({ error: "Connect X before verifying quests." }, { status: 401 });
  }
  const body = await request.json() as { quest?: XQuest };
  if (
    body.quest !== "follow"
    && body.quest !== "post"
    && body.quest !== "like"
    && body.quest !== "retweet"
  ) {
    return Response.json({ error: "Unsupported quest." }, { status: 400 });
  }
  try {
    return Response.json(await verifyXQuest(session.id, body.quest));
  } catch (error) {
    if (error instanceof XQuestCooldown) {
      return Response.json(
        { error: error.message, nextCheckAt: error.nextCheckAt },
        { status: 429 },
      );
    }
    if (error instanceof XVerificationUnavailable) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
