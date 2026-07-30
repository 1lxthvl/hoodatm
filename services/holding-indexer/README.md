# Holding indexer

Indexes finalized ERC20 `Transfer` logs into PostgreSQL, maintains checkpointed
balances, computes exact rolling 24-hour TWABs, and optionally submits hourly
oracle batches.

## Safety model

- Only blocks at least `CONFIRMATIONS` deep are indexed.
- Every committed range has a block-hash anchor. Startup compares anchors with
  the canonical chain and transactionally rolls back to the newest common
  anchor before resuming.
- `(transaction_hash, log_index)` is the event identity. Event insertion,
  balance mutation, anchor creation, and checkpoint advancement share one
  database transaction.
- TWAB uses block timestamps and arbitrary-precision integer token-seconds over
  exactly 86,400 seconds. The submitted value is the quotient rounded down;
  the remainder is retained by the calculation and never lost to floating
  point.
- Transaction submission is disabled by default. The reporter key is read only
  from `REPORTER_PRIVATE_KEY`; never place it in source, images, unit files, or
  command-line arguments.

The configured `START_BLOCK` must be the token deployment block (or an earlier
block). Starting later can produce an invalid negative balance when an account
sends tokens it received before indexing began.

## Oracle contract requirement

The target contract must expose:

```solidity
function isBatchSubmitted(bytes32 batchId) external view returns (bool);
function submitBatch(
    bytes32 batchId,
    uint64 reportTimestamp,
    address[] calldata accounts,
    uint256[] calldata twabs
) external;
```

It must reject duplicate `batchId` values and authorize the reporter. Batch IDs
are `keccak256(abi.encode(reportTimestamp, accounts, twabs))`. The service checks
the on-chain ID, records each transaction hash, and resumes pending batches
after restart. This contract-level uniqueness closes the unavoidable crash
window between transaction broadcast and local persistence.

## Local setup

Requirements: Node.js 22+ and PostgreSQL 15+.

```sh
cp .env.example .env
npm ci
npm run db:migrate
npm test
npm run build
```

Export the variables from `.env` using your process manager, then run
`npm start`. Keep `SUBMIT_TRANSACTIONS=false` through backfill and validate the
computed output before enabling a funded reporter.

## Deployment

### Container

```sh
docker build -t holding-indexer:1.0.0 .
docker run --rm --env-file /run/secrets/holding-indexer.env \
  -p 127.0.0.1:9460:9460 holding-indexer:1.0.0
```

Mount or inject the environment file at runtime; do not bake it into the image.

### systemd

1. Install the built service at `/opt/holding-indexer` and create an unprivileged
   `holding-indexer` user.
2. Create `/etc/holding-indexer/holding-indexer.env`, owned by root with mode
   `0600`. Reference the reporter key there only if submission is enabled.
3. Copy `deploy/holding-indexer.service` to `/etc/systemd/system/`.
4. Run `systemctl daemon-reload && systemctl enable --now holding-indexer`.

## Operations runbook

### Health and metrics

- `GET /healthz`: process is serving.
- `GET /readyz`: migrations and canonical-chain reconciliation completed.
- `GET /metrics`: Prometheus metrics.

Alert on a growing `chain_head - indexed_block`, repeated
`rpc_retries_total`, any `reorgs_total` increase, and failed oracle runs. The
service logs structured JSON to stdout/journald.

### Backfill is behind

Check RPC rate-limit logs and database latency. Reduce `BLOCK_BATCH_SIZE` when
the RPC rejects large log ranges; increase it cautiously for sparse tokens.
Restarting is safe because the database checkpoint advances only after a whole
batch commits.

### Reorganization

No operator action is normally required. Restart reconciliation finds the
newest canonical anchor, deletes later events, rebuilds balances, and resumes.
Investigate any reorg deeper than `CONFIRMATIONS`; increase confirmations if the
chain's finality assumptions require it.

### Oracle transaction failure

Keep the service running while the RPC is transiently unavailable. For a
reverted transaction, inspect reporter authorization, contract pause state,
funding, and the expected ABI. Do not manually delete batch rows. After fixing
the cause, restart; failed/pending batches are retried and on-chain batch IDs
prevent duplicates.

### Database recovery

Restore PostgreSQL from backup, then restart. If the restored checkpoint is
behind, backfill resumes. If event data is intentionally discarded, clear all
service tables together and set `START_BLOCK` to the deployment block; never
retain balances without their corresponding transfer history.

### Key rotation

Stop the service, rotate authorization on the oracle contract through the
normal governance process, update the host secret referenced by
`REPORTER_PRIVATE_KEY`, and restart. The service never logs the key.
