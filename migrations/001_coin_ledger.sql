-- Klasik Tavla trusted coin ledger — PostgreSQL migration 001
-- Apply only after a staging database is provisioned and reviewed.
-- Every balance mutation must run in one DB transaction:
--   SELECT balance FROM coin_accounts WHERE firebase_uid = $1 FOR UPDATE;
--   validate balance/reward policy; INSERT ledger row with idempotency key;
--   UPDATE account balance; COMMIT.
-- Never accept amount, balance_after, transaction type, or match result as client authority.

CREATE TABLE IF NOT EXISTS coin_accounts (
  firebase_uid TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 500 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firebase_uid TEXT NOT NULL REFERENCES coin_accounts(firebase_uid),
  idempotency_key TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'welcome_bonus',
      'guest_migration',
      'daily_reward',
      'ad_reward',
      'match_fee',
      'match_reward',
      'match_refund',
      'admin_adjustment'
    )
  ),
  amount BIGINT NOT NULL CHECK (amount <> 0),
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coin_ledger_idempotency_per_user UNIQUE (firebase_uid, idempotency_key)
);

CREATE INDEX IF NOT EXISTS coin_ledger_user_created_idx
  ON coin_ledger (firebase_uid, created_at DESC);

CREATE INDEX IF NOT EXISTS coin_ledger_reference_idx
  ON coin_ledger (reference_id)
  WHERE reference_id IS NOT NULL;

COMMENT ON TABLE coin_accounts IS
  'Authoritative coin balances. Client applications must never write this table directly.';
COMMENT ON TABLE coin_ledger IS
  'Append-only audit ledger. Every balance change must have one matching ledger row in the same DB transaction.';
