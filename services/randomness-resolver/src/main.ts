import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig, type ResolverConfig } from "./config.js";
import { ResolveError, resolveRandomness, type ResolveRequest } from "./resolve.js";

const config = loadConfig();

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const limit = 16_384;

    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new ResolveError(413, "Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        reject(new ResolveError(400, "JSON body required."));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new ResolveError(400, "Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function authorize(request: IncomingMessage, cfg: ResolverConfig): void {
  if (!cfg.apiToken) return;
  const header = request.headers.authorization;
  if (header !== `Bearer ${cfg.apiToken}`) {
    throw new ResolveError(401, "Unauthorized.");
  }
}

async function handleResolve(
  request: IncomingMessage,
  response: ServerResponse,
  cfg: ResolverConfig,
) {
  authorize(request, cfg);
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    throw new ResolveError(400, "JSON object required.");
  }
  const result = await resolveRandomness(cfg, body as ResolveRequest);
  sendJson(response, 200, result);
}

const server = createServer((request, response) => {
  void (async () => {
    try {
      const method = request.method ?? "GET";
      const path = request.url?.split("?", 1)[0] ?? "/";

      if (method === "GET" && (path === "/healthz" || path === "/health")) {
        sendJson(response, 200, {
          ok: true,
          signer: config.account.address,
          verifyingContract: config.verifyingContract,
        });
        return;
      }

      if (method === "POST" && path === "/resolve") {
        await handleResolve(request, response, config);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof ResolveError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error("resolve request failed", error instanceof Error ? error.message : error);
      sendJson(response, 500, { error: "Internal server error." });
    }
  })();
});

server.listen(config.port, config.host, () => {
  console.info(
    JSON.stringify({
      msg: "randomness-resolver listening",
      host: config.host,
      port: config.port,
      signer: config.account.address,
      verifyingContract: config.verifyingContract,
      authRequired: Boolean(config.apiToken),
    }),
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.info(JSON.stringify({ msg: "shutdown requested", signal }));
    server.close(() => process.exit(0));
  });
}
