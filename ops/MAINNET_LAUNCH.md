# Paused GCP mainnet launch

This procedure deliberately stops before any signing, funding, unpause, or
`NEXT_PUBLIC_GAME_LIVE=true` action. Production data is under
`/var/lib/hoodatm`; releases are extracted only into `/opt/hoodatm`.

## 1. Local release gate

```powershell
npm.cmd ci
npm.cmd run contracts:compile
Push-Location contracts; forge test -vv; forge build --sizes; Pop-Location
npm.cmd run lint
npm.cmd run build
```

Build with `NEXT_PUBLIC_GAME_LIVE=false` and blank production contract
addresses. Do not package `.env*`, `.data`, private keys, registry JSON, or
indexer checkpoints.

## 2. Preserve and deploy the paused app

On the GCP VM, verify the persistent data before and after extraction:

```bash
sudo install -d -o hoodatm -g hoodatm -m 0750 /var/lib/hoodatm
sudo sha256sum /var/lib/hoodatm/{players.json,access-codes.json,x-tokens.json} 2>/dev/null || true
sudo cp -a /var/lib/hoodatm "/var/backups/hoodatm-$(date -u +%Y%m%dT%H%M%SZ)"
sudo bash /opt/hoodatm/ops/scripts/deploy-extract.sh
sudo sha256sum /var/lib/hoodatm/{players.json,access-codes.json,x-tokens.json} 2>/dev/null || true
```

The deploy script may replace `/opt/hoodatm`; it must never remove, copy over,
or initialize the three existing registry files.

## 3. Signing prerequisites

Pause and ask the operator before broadcasting anything. Required inputs are:

- funded Robinhood Chain mainnet deployer key/address;
- treasury signer access for
  `0x7657d90609046F47215Fc0Fb2BF012c88FF9f700`;
- separately secured resolver signer and holding-oracle reporter signer;
- mainnet RPC URL with chain ID `4663`;
- explorer API/verification support;
- enough ETH for deployment and configuration transactions;
- enough `$GANGSTER` for the approved reward and bonus funding amounts.

Private keys belong in a secret manager or root-readable environment file, never
in this directory, shell history, deployment archive, or a `NEXT_PUBLIC_*`
variable.

## 4. Paused contract deployment

After explicit signing approval, deploy the price oracle, holding oracle,
`ATMGame`, and `GangSystem` using the reviewed deployment script. Validate:

- every owner/treasury address equals the treasury above;
- both game contracts report `paused() == true`;
- resolver and reporter addresses match the approved isolated signers;
- the full required join ETH reaches treasury in a fork/mainnet simulation;
- referral accounting is `$GANGSTER`-denominated;
- resolver domain/chain/contract/request replay protection is enabled.

Configure the pool observation cardinality, wait the complete TWAP window, then
run the indexer for at least 24 hours. Confirm fresh hourly holding observations
and test resolver timeout recovery while the game remains paused.

## 5. Final validation and activation

Record deployed bytecode hashes, verified explorer links, role addresses, oracle
freshness, indexer metrics, resolver health, reward balances, and frontend read
results. Only after independent approval:

1. build the frontend with validated contract addresses, still with
   `NEXT_PUBLIC_GAME_LIVE=false`;
2. perform treasury-signed role/configuration transactions;
3. unpause contracts in the approved order;
4. rebuild with `NEXT_PUBLIC_GAME_LIVE=true`;
5. deploy and smoke-test reads and one explicitly approved low-value action.

Unpausing and setting the live flag are separate approval gates.
