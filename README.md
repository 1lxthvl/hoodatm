# hoodATM

hoodATM is a Robinhood Chain strategy game built around persistent idle hustling, player robberies, ATM hits, gangs, jail systems, referrals, and `$GANGSTER` token economics.

The public repository contains the application and smart-contract source. Production credentials, X OAuth secrets, wallet connection credentials, deployment keys, player records, IP addresses, access codes, and OAuth tokens are intentionally excluded.

## Stack

- Next.js 16 and React 19
- TypeScript and Tailwind CSS
- wagmi, viem, and RainbowKit
- Solidity contracts for Robinhood Chain

## Local development

Requirements:

- Node.js 24.18.0 (pinned in `.nvmrc`)
- npm

Create a local environment file from the public template:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before submitting a change:

```bash
npm run lint
npm run build
```

## Environment and private data

Only `.env.example` belongs in source control. Keep actual values in `.env.local` or in the production server’s protected environment.

The following must never be committed:

- X client secrets and session-signing secrets
- WalletConnect project credentials
- private keys, seed phrases, deployment keys, or operator credentials
- player wallets linked to usernames, IP addresses, access codes, and OAuth tokens
- server backups, release archives, logs, and machine-specific or secret-bearing production configuration

Production registries are stored outside the application directory under `/var/lib/hoodatm` and are not part of this repository.

For a complete new-computer setup and the sanitized Nginx/systemd files, see
[RESTORE.md](RESTORE.md).

## Smart contracts

Contract source and deployment requirements are documented in [contracts/README.md](contracts/README.md). Contracts must remain paused until they have been independently audited, configured, funded, verified, and tested against the production frontend.

Never place a private key in this repository or expose one through a `NEXT_PUBLIC_` environment variable.

## Repository visibility

Application and contract source may be published publicly. Account data and operational secrets remain private to the production operator.
