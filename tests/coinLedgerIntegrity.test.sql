-- Manual staging verification for migrations 001 and 002.
-- Safe to run against staging: all test rows are rolled back.
-- Run with psql -v ON_ERROR_STOP=1 -f tests/coinLedgerIntegrity.test.sql "$DATABASE_URL"

BEGIN;

INSERT INTO public.coin_accounts (firebase_uid, balance)
VALUES ('__coin_ledger_integrity_test__', 500);

INSERT INTO public.coin_ledger (
  firebase_uid, idempotency_key, transaction_type, amount, balance_after, reference_id
) VALUES (
  '__coin_ledger_integrity_test__', 'integrity-valid-fee', 'match_fee', -100, 400, 'integrity-test'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.coin_accounts (firebase_uid, balance)
    VALUES ('__coin_ledger_negative_balance_test__', -1);
    RAISE EXCEPTION 'Expected the balance constraint to reject a negative account balance.';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: negative account balance rejected';
  END;

  BEGIN
    INSERT INTO public.coin_ledger (
      firebase_uid, idempotency_key, transaction_type, amount, balance_after
    ) VALUES (
      '__coin_ledger_integrity_test__', 'integrity-valid-fee', 'match_fee', -100, 300
    );
    RAISE EXCEPTION 'Expected the per-user idempotency constraint to reject a duplicate key.';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: duplicate per-user idempotency key rejected';
  END;

  BEGIN
    INSERT INTO public.coin_ledger (
      firebase_uid, idempotency_key, transaction_type, amount, balance_after
    ) VALUES (
      '__coin_ledger_integrity_test__', 'integrity-zero-amount', 'match_fee', 0, 400
    );
    RAISE EXCEPTION 'Expected the amount constraint to reject a zero-value ledger row.';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: zero-value ledger entry rejected';
  END;

  BEGIN
    INSERT INTO public.coin_ledger (
      firebase_uid, idempotency_key, transaction_type, amount, balance_after
    ) VALUES (
      '__coin_ledger_integrity_test__', 'integrity-invalid-fee-sign', 'match_fee', 100, 600
    );
    RAISE EXCEPTION 'Expected the amount-sign constraint to reject a positive match_fee.';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: invalid match_fee amount sign rejected';
  END;

  BEGIN
    UPDATE public.coin_ledger
    SET metadata = '{"tampered": true}'::jsonb
    WHERE firebase_uid = '__coin_ledger_integrity_test__'
      AND idempotency_key = 'integrity-valid-fee';
    RAISE EXCEPTION 'Expected the append-only trigger to reject UPDATE.';
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      RAISE NOTICE 'PASS: ledger UPDATE rejected';
  END;

  BEGIN
    DELETE FROM public.coin_ledger
    WHERE firebase_uid = '__coin_ledger_integrity_test__'
      AND idempotency_key = 'integrity-valid-fee';
    RAISE EXCEPTION 'Expected the append-only trigger to reject DELETE.';
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      RAISE NOTICE 'PASS: ledger DELETE rejected';
  END;
END
$$;

ROLLBACK;
