# Restore hoodATM on another computer

The private repository contains the complete development source, contracts,
assets, dependency lockfile, and sanitized deployment configuration.

## 1. Clone the private repository

Sign in to the GitHub account that owns the repository, then run:

```bash
git clone https://github.com/1lxthvl/hoodatm-private.git hoodatm
cd hoodatm
```

## 2. Install the pinned runtime and dependencies

The project currently uses Node.js `24.18.0`, recorded in `.nvmrc`.

```bash
nvm install
nvm use
npm ci
```

On Windows without NVM, install Node.js 24 and run `npm.cmd ci`.

## 3. Restore environment configuration

Create a local environment file from the committed blank template:

```bash
cp .env.example .env.local
```

For local development, point the registry paths at a writable local folder:

```bash
HOODATM_PLAYER_LOG_PATH=.data/players.json
HOODATM_ACCESS_CODE_LOG_PATH=.data/access-codes.json
HOODATM_X_TOKEN_LOG_PATH=.data/x-tokens.json
```

Fill remaining secrets from the project owner's password manager or the
root-owned GCP VM environment files. Never commit the populated file.

## 4. Validate the restored project

```bash
npm run lint
npm run build
npm run contracts:compile
npm run dev
```

The local site will be available at `http://localhost:3000`.

## 5. Production on the GCP VM

Bootstrap the Ubuntu VM with `ops/scripts/bootstrap-gcp.sh`. The app runs from
`/opt/hoodatm` under systemd and nginx. Secrets are stored in
`/etc/hoodatm.env`; persistent registries are stored in `/var/lib/hoodatm`.

Before every release, back up and checksum `players.json`,
`access-codes.json`, and `x-tokens.json`. Build the standalone archive locally,
upload it to `/tmp/hoodatm-deploy.tar`, and run
`sudo ops/scripts/deploy-extract.sh`. That script replaces only `/opt/hoodatm`.
It must never initialize, remove, or overwrite files under `/var/lib/hoodatm`.

Required runtime configuration includes `PORT=3000`,
`HOODATM_APP_URL=https://hoodatm.online`, X OAuth/session secrets, the three
`/var/lib/hoodatm/*.json` paths, and resolver state at
`/var/lib/hoodatm/resolver-actions.json`. Public contract addresses and
`NEXT_PUBLIC_GAME_LIVE` are embedded at build time.

### Domain and OAuth

1. Point `hoodatm.online` and `www` to the GCP VM and keep nginx/TLS current.
2. Confirm the X Developer App callback remains
   `https://hoodatm.online/api/auth/x/callback`.

### Seed registries from an old server

1. Copy `players.json`, `access-codes.json`, and `x-tokens.json` from the old
   host into an encrypted local archive.
2. Stop `hoodatm`, place the files in `/var/lib/hoodatm`, set ownership to
   `hoodatm:hoodatm` and mode `0600`, then restart the service.
3. Compare record counts and checksums before deleting the encrypted transfer.
4. Sign in as `@rhoodatm` and confirm `/admin` shows the expected players.

## 6. Local backups (required)

The GCP persistent disk is not a backup. Keep encrypted off-VM copies.

### Download from production

1. Sign in to https://hoodatm.online as `@rhoodatm`.
2. Open `/admin`.
3. Click **Download local backup**.
4. Store `hoodatm-backup-YYYYMMDD.json` encrypted offline (password manager,
   encrypted drive, or private object storage you control).

The file includes players (stats), access codes, and X OAuth grants. Treat it
as secret material. Never commit it to Git.

Download before major releases and at least weekly while the game is live.

### Restore from a local backup

There is no public restore API (avoids accidental wipe). Restore by writing the
three registry files the GCP app expects:

1. From `hoodatm-backup-*.json`, extract:
   - `players` → `players.json`
   - `accessCodes` → `access-codes.json`
   - `xTokens` → `x-tokens.json`
2. Place them at the configured `HOODATM_*_LOG_PATH` locations
   (GCP: `/var/lib/hoodatm/`; local: `.data/`).
3. Restart the app and verify `/admin`.

## Intentionally excluded from Git

Restore these through a secure encrypted backup or password manager rather than
GitHub:

- SSH private keys;
- populated `.env` files and OAuth/session secrets;
- wallet private keys or seed phrases;
- live player, access-code, X-token, and IP-address registries;
- `hoodatm-backup-*.json` downloads;
- generated `node_modules`, `.next`, logs, and release archives.

Dependencies are recreated with `npm ci` and builds with `npm run build`.
Live registry data must be backed up separately.
