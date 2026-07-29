import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequestOrigin } from "../../../lib/request-origin";

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?x=configuration-required", origin));
  }

  const state = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(64)));
  const verifierHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const callbackUrl = new URL("/api/auth/x/callback", origin).toString();
  const authorizeUrl = new URL(AUTHORIZE_URL);

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", "users.read tweet.read like.read follows.read offline.access");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", toBase64Url(new Uint8Array(verifierHash)));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  const cookieStore = await cookies();
  cookieStore.set("hoodatm_x_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  cookieStore.set("hoodatm_x_oauth_verifier", verifier, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
