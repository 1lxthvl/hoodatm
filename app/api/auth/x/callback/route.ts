import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequestOrigin } from "../../../../lib/request-origin";
import { createXSession } from "../../../../lib/x-session";
import { saveXGrant } from "../../../../lib/x-quest-registry";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const USER_URL = "https://api.x.com/2/users/me?user.fields=id,name,username";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("hoodatm_x_oauth_state")?.value;
  const verifier = cookieStore.get("hoodatm_x_oauth_verifier")?.value;
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const sessionSecret = process.env.HOODATM_SESSION_SECRET;
  const clearCookies = () => {
    cookieStore.delete("hoodatm_x_oauth_state");
    cookieStore.delete("hoodatm_x_oauth_verifier");
  };

  if (!code || !state || state !== expectedState || !verifier || !clientId || !sessionSecret) {
    clearCookies();
    return NextResponse.redirect(new URL("/?x=sign-in-failed", origin));
  }

  try {
    const callbackUrl = new URL("/api/auth/x/callback", origin).toString();
    const tokenHeaders: HeadersInit = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const tokenBody = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code_verifier: verifier,
    });

    if (clientSecret) {
      tokenHeaders.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    } else {
      tokenBody.set("client_id", clientId);
    }

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody,
      cache: "no-store",
    });
    const token = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!tokenResponse.ok || !token.access_token) throw new Error("Token exchange failed");

    const userResponse = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    const userPayload = await userResponse.json() as { data?: { id: string; name: string; username: string } };
    if (!userResponse.ok || !userPayload.data) throw new Error("User lookup failed");
    await saveXGrant({
      userId: userPayload.data.id,
      username: userPayload.data.username,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresIn: token.expires_in ?? 7200,
      scopes: token.scope?.split(" ").filter(Boolean) ?? [],
    });

    const response = NextResponse.redirect(new URL("/?x=connected", origin));
    response.cookies.set("hoodatm_x_session", createXSession(userPayload.data, sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
    response.cookies.delete("hoodatm_x_oauth_state");
    response.cookies.delete("hoodatm_x_oauth_verifier");
    return response;
  } catch {
    clearCookies();
    return NextResponse.redirect(new URL("/?x=sign-in-failed", origin));
  }
}
