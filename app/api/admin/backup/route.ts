import { cookies } from "next/headers";
import { listAccessCodes } from "../../../lib/access-code-registry";
import { listTrackedPlayers } from "../../../lib/player-registry";
import { listXGrantsForBackup } from "../../../lib/x-quest-registry";
import { readXSession } from "../../../lib/x-session";

async function isAdmin() {
  const cookieStore = await cookies();
  const session = readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  return session?.username.toLowerCase() === "rhoodatm";
}

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [players, accessCodes, xTokens] = await Promise.all([
    listTrackedPlayers(),
    listAccessCodes(),
    listXGrantsForBackup(),
  ]);

  const exportedAt = new Date().toISOString();
  const stamp = exportedAt.slice(0, 10).replaceAll("-", "");
  const payload = {
    version: 1,
    exportedAt,
    players,
    accessCodes,
    xTokens,
  };

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hoodatm-backup-${stamp}.json"`,
    },
  });
}
