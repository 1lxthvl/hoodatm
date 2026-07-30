import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequestOrigin } from "../../../../lib/request-origin";
import { createXSession } from "../../../../lib/x-session";
import { saveXGrant } from "../../../../lib/x-quest-registry";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const USER_URL = "https://api.x.com/2/users/me?user.fields=id,name,username";

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

type UserPayload = {
  data?: {
    id: string;
    name: string;
    username: string;
  };
};

function clearTemporaryCookies(response: NextResponse) {
  response.cookies.delete("hoodatm_x_oauth_state");
  response.cookies.delete("hoodatm_x_oauth_verifier");
}

function failedResponse(origin: string) {
  const response = NextResponse.redirect(new URL("/?x=sign-in-failed", origin));
  clearTemporaryCookies(response);
  return response;
}

async function readJson<T>(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = cookieStore.get("hoodatm_x_oauth_state")?.value;
  const verifier = cookieStore.get("hoodatm_x_oauth_verifier")?.value;
  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.HOODATM_SESSION_SECRET?.trim();

  if (
    requestUrl.searchParams.has("error")
    || !code
    || !state
    || !expectedState
    || state !== expectedState
    || !verifier
    || !clientId
    || !sessionSecret
  ) {
    return failedResponse(origin);
  }

  try {
    const callbackUrl = new URL("/api/auth/x/callback", origin).toString();
    const tokenHeaders = new Headers({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const tokenBody = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code_verifier: verifier,
    });

    if (clientSecret) {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
      tokenHeaders.set("Authorization", `Basic ${credentials}`);
    } else {
      tokenBody.set("client_id", clientId);
    }

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody,
      cache: "no-store",
    });
    const token = await readJson<TokenPayload>(tokenResponse);
    if (!tokenResponse.ok || !token?.access_token) {
      console.error(
        "[x-oauth] token exchange failed",
        tokenResponse.status,
        token?.error ?? "invalid-response",
      );
      return failedResponse(origin);
    }

    const userResponse = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    const userPayload = await readJson<UserPayload>(userResponse);
    if (!userResponse.ok || !userPayload?.data) {
      console.error("[x-oauth] user lookup failed", userResponse.status);
      return failedResponse(origin);
    }

    const user = userPayload.data;
    await saveXGrant({
      userId: user.id,
      username: user.username,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresIn: token.expires_in ?? 7200,
      scopes: token.scope?.split(" ").filter(Boolean) ?? [],
    });

    const response = NextResponse.redirect(new URL("/?x=connected", origin));
    response.cookies.set("hoodatm_x_session", createXSession(user, sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
    clearTemporaryCookies(response);
    return response;
  } catch (error) {
    console.error("[x-oauth] callback failed", error instanceof Error ? error.message : error);
    return failedResponse(origin);
  }
}
