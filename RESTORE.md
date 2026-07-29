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

Fill the values from the project owner's password manager or the production
server's `/etc/hoodatm.env`. Never commit the populated file.

## 4. Validate the restored project

```bash
npm run lint
npm run build
npm run contracts:compile
npm run dev
```

The local site will be available at `http://localhost:3000`.

## 5. Production configuration

- Nginx: `ops/nginx/hoodatm.conf`
- systemd: `ops/systemd/hoodatm.service`
- deploy public key: `ops/ssh/hoodatm-deploy.pub`
- application directory: `/opt/hoodatm`
- production environment file: `/etc/hoodatm.env`

## Intentionally excluded from Git

The following must be restored through a secure encrypted backup or password
manager rather than GitHub:

- SSH private keys;
- populated `.env` files and OAuth/session secrets;
- wallet private keys or seed phrases;
- live player, access-code, X-token, and IP-address registries;
- generated `node_modules`, `.next`, logs, and release archives.

These exclusions do not prevent development on another computer. Dependencies
are recreated with `npm ci`, builds with `npm run build`, and release archives
from the committed source. Live server data remains in `/var/lib/hoodatm` and
should be backed up separately using encrypted storage.
