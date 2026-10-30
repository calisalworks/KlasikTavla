-- Klasik Tavla trusted coin ledger — migration 002
-- Apply to the staging database after migration 001.
-- This migration adds database-level guardrails; it does not activate app endpoints.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coin_ledger_transaction_amount_sign_check'
      AND conrelid = 'public.coin_ledger'::regclass
  ) THEN
    ALTER TABLE public.coin_ledger
      ADD CONSTRAINT coin_ledger_transaction_amount_sign_check
      CHECK (
        (transaction_type = 'match_fee' AND amount < 0)
        OR (
          transaction_type IN (
            'welcome_bonus',
            'guest_migration',
            'daily_reward',
            'ad_reward',
            'match_reward',
            'match_refund'
          )
          AND amount > 0
        )
        OR transaction_type = 'admin_adjustment'
      );
  END IF;
END
$$;

-- Ledger rows are audit records: corrections must be compensating entries,
-- never UPDATE/DELETE of historical transactions.
CREATE OR REPLACE FUNCTION public.prevent_coin_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'coin_ledger is append-only; use a compensating entry'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS coin_ledger_append_only_guard ON public.coin_ledger;

CREATE TRIGGER coin_ledger_append_only_guard
BEFORE UPDATE OR DELETE ON public.coin_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_coin_ledger_mutation();

COMMENT ON FUNCTION public.prevent_coin_ledger_mutation() IS
  'Rejects UPDATE/DELETE of coin ledger history; use compensating ledger entries.';
