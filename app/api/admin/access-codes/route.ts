import { cookies } from "next/headers";
import { generateAccessCode, listAccessCodes } from "../../../lib/access-code-registry";
import { isAdminUsername } from "../../../lib/admin-access";
import { gangsterCharacters, type GangsterCharacter } from "../../../lib/player-registry";
import { readXSession } from "../../../lib/x-session";

async function adminUsername() {
  const cookieStore = await cookies();
  const session = readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  const username = session?.username.toLowerCase();
  return isAdminUsername(username) ? username : null;
}

export async function GET() {
  if (!(await adminUsername())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(
    { codes: await listAccessCodes() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const username = await adminUsername();
  if (!username) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as {
    type?: "hood-access" | "character-claim";
    character?: GangsterCharacter | null;
  };
  const type = body.type === "character-claim" ? "character-claim" : "hood-access";
  const character = type === "character-claim" && body.character
    && gangsterCharacters.includes(body.character)
    ? body.character
    : null;
  if (type === "character-claim" && !character) {
    return Response.json({ error: "Choose a gangster character." }, { status: 400 });
  }
  return Response.json(
    { code: await generateAccessCode(username, type, character) },
    { status: 201 },
  );
}
