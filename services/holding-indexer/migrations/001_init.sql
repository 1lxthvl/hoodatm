BEGIN;

CREATE TABLE IF NOT EXISTS indexer_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  next_block bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS block_anchors (
  block_number bigint PRIMARY KEY,
  block_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_events (
  tx_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  block_timestamp bigint NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  amount numeric(78, 0) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS transfer_events_block_idx
  ON transfer_events (block_number);
CREATE INDEX IF NOT EXISTS transfer_events_time_idx
  ON transfer_events (block_timestamp, block_number, log_index);
CREATE INDEX IF NOT EXISTS transfer_events_from_idx
  ON transfer_events (from_address);
CREATE INDEX IF NOT EXISTS transfer_events_to_idx
  ON transfer_events (to_address);

CREATE TABLE IF NOT EXISTS balances (
  address text PRIMARY KEY,
  amount numeric(78, 0) NOT NULL CHECK (amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oracle_runs (
  report_timestamp bigint PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'dry_run')),
  transaction_hash text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oracle_batches (
  report_timestamp bigint NOT NULL REFERENCES oracle_runs(report_timestamp) ON DELETE CASCADE,
  batch_index integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'dry_run')),
  transaction_hash text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_timestamp, batch_index)
);

COMMIT;
