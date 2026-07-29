export function getRequestOrigin(request: Request) {
  const configuredOrigin = process.env.HOODATM_APP_URL?.trim();
  if (configuredOrigin) {
    return new URL(configuredOrigin).origin;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : requestUrl.origin;
}
