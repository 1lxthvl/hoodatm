import { createHmac, timingSafeEqual } from "node:crypto";

type XSession = {
  id: string;
  name: string;
  username: string;
  expiresAt: number;
};

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createXSession(value: Omit<XSession, "expiresAt">, secret: string) {
  const payload = Buffer.from(JSON.stringify({ ...value, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readXSession(value: string | undefined, secret: string | undefined): XSession | null {
  if (!value || !secret) return null;
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) return null;

  const expectedSignature = signature(payload, secret);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as XSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}
