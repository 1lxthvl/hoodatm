# Randomness resolver

Isolated HTTP service that signs hoodATM EIP-712 randomness attestations.
The Next.js app calls this over `HOODATM_RESOLVER_URL`; the resolver private key
never enters the app VM.

## Protocol

`POST /resolve`

Request:

```json
{
  "chainId": 4663,
  "account": "0xPlayer…",
  "contract": "0xATMGameOrGangSystem…",
  "requestId": "0x…32bytes",
  "commitment": "0x…32bytes"
}
```

Response:

```json
{
  "randomWord": "123456789…",
  "deadline": "1730000000",
  "signature": "0x…"
}
```

- Rejects any `chainId` other than `4663`.
- EIP-712 domain: name `hoodATM RandomnessResolver`, version `1`, chainId `4663`,
  `verifyingContract` = `RANDOMNESS_RESOLVER_CONTRACT` (the deployed verifier, not
  the signer).
- Typed data: `Resolution(address consumer,bytes32 requestId,bytes32 commitment,uint256 randomWord,uint64 deadline)`.
- `consumer` is the request `contract` (the game/gang address that will call
  `consume` as `msg.sender`).
- `randomWord` is 32 cryptographically secure random bytes as a decimal string.
- `deadline` is unix seconds, about 50 minutes ahead (under the one-hour action
  expiry).

`GET /healthz` returns the configured signer and verifying contract addresses.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `RANDOMNESS_RESOLVER_CONTRACT` | yes | Deployed `RandomnessResolver` verifier address |
| `RESOLVER_PRIVATE_KEY` | yes | Authorized signer key (`RandomnessResolver.resolver()`) |
| `RESOLVER_API_TOKEN` | no | Bearer token; when set, require `Authorization: Bearer …` |
| `HOST` | no | Bind address (default `127.0.0.1`) |
| `PORT` | no | Listen port (default `8787`) |

Never commit `RESOLVER_PRIVATE_KEY`. Never prefix it with `NEXT_PUBLIC_`.

App-side counterparts:

- `HOODATM_RESOLVER_URL=http://127.0.0.1:8787/resolve`
- `HOODATM_RESOLVER_API_TOKEN=` (same value as `RESOLVER_API_TOKEN` when used)

## Local setup

```sh
cp .env.example .env
# fill RANDOMNESS_RESOLVER_CONTRACT and RESOLVER_PRIVATE_KEY
npm ci
npm run build
npm start
```

Development watch mode: `npm run dev` (load env via your shell or process manager).

## Deployment

### Container

```sh
docker build -t randomness-resolver:1.0.0 .
docker run --rm --env-file /run/secrets/randomness-resolver.env \
  -p 127.0.0.1:8787:8787 randomness-resolver:1.0.0
```

Inject secrets at runtime; do not bake keys into the image.

### systemd

Service unit: `deploy/randomness-resolver.service`  
Unit name: `randomness-resolver`  
Listen: `127.0.0.1:8787`

1. Install the build at `/opt/randomness-resolver` and create an unprivileged
   `randomness-resolver` user.
2. Create `/etc/randomness-resolver/randomness-resolver.env` owned by root with
   mode `0600`, containing `RANDOMNESS_RESOLVER_CONTRACT`, `RESOLVER_PRIVATE_KEY`,
   and optionally `RESOLVER_API_TOKEN`.
3. Copy `deploy/randomness-resolver.service` to `/etc/systemd/system/`.
4. `systemctl daemon-reload && systemctl enable --now randomness-resolver`.

Point the app VM at the private endpoint with `HOODATM_RESOLVER_URL` (and matching
API token). Keep the signer host separate from the public frontend host when
possible.
