# Trusted Coin Ledger Migration Plan

## Current release-safety posture

The temporary economy endpoints deliberately return HTTP 503 outside `NODE_ENV=test`. Do not remove those guards until the trusted ledger and identity checks below are deployed and tested. A green build does not mean coin rewards or paid matches are production-ready.

## Security gaps to close

- Firestore clients can currently create user profiles with arbitrary starting `coins`, stats, trophies, and level.
- Firestore clients can currently update their own economic fields, including `coins`, `wins`, `losses`, `abandoned`, `trophies`, and `level`.
- A signed-in user's client can create arbitrary append-only `coinTransactions` documents. Append-only prevents edits, not forged entries.
- The current Express economy endpoints do not yet verify Firebase ID tokens and do not persist an authoritative ledger. The client now attaches a fresh Firebase ID token to its five coin/match REST calls when a Firebase user is signed in; guest requests remain unauthenticated. This is transport groundwork only: until the server verifies each token and derives the UID from the verified claims, the body `userId` is not trusted and the production 503 guards must remain.
- WebSocket player IDs and profile data are client supplied. Never use them as proof of account ownership or a verified match result.
- AdMob reward claims must be based on a verified server-side verification (SSV) callback, not a client-generated proof string.

## Safe implementation order

1. **Complete server identity verification.** A dependency-free Firebase ID-token verifier now validates the RS256 signature against Google's published Secure Token JWKs and checks issuer, audience, UID, and time claims. `/api/auth/session` exposes a minimal session probe and fails closed when `FIREBASE_PROJECT_ID` is missing. Add positive/negative verifier tests (including bad signature, wrong project/audience, expired token, unknown key, and key-fetch failure), then wire the verified UID into each economy route. The session probe alone does not protect coin operations. Guest support needs a separate, explicitly limited policy.
2. **Add a durable, atomic ledger.** Use a trusted server transaction to read the balance, enforce non-negative balances and reward cooldowns, write the balance and ledger entry atomically, and enforce idempotency keys. A process-local `Map` is not durable and is not safe across multiple server instances.
3. **Migrate profile creation.** Move starting balances and guest migration to a trusted server operation. Validate migration once and prevent a client from choosing the transferred balance.
4. **Migrate match settlement.** The server must verify the room, players, completed match, winner, fee tier, and one-time settlement state. Do not accept client-provided fee/prize amounts as authoritative.
5. **Migrate stats and progression.** Move wins/losses/abandonments/trophies/level updates to trusted operations; define how existing local/guest progress is reconciled.
6. **Implement AdMob SSV.** Verify Google's callback signature and required parameters, validate the ad unit/reward/user binding, and reject duplicate transaction IDs.
7. **Tighten Firestore rules only after migration.** Deny client writes to economic/profile-progression fields and deny client creation of ledger records. Preserve safe profile edits and read access as needed.
8. **Validate with rules/emulator tests and staging.** Cover forged/missing/expired tokens, cross-user requests, replay, concurrent claims, insufficient balance, negative balances, duplicate match settlement, forged match results, guest migration, and missing server configuration.
9. **Re-enable production endpoints only after evidence.** Require passing tests, configured production credentials, staging verification, and review of deployment configuration. Do not enable a mock fallback in production.

## Acceptance criteria

- Every authenticated economy request is bound to the UID from a verified Firebase ID token.
- No client can directly create or change balances, ledger records, match rewards, or progression fields.
- Balance changes and ledger writes are atomic, durable, non-negative, and idempotent.
- Match fees and prizes are derived from server-owned room/match state.
- Ad rewards require verified AdMob SSV and cannot be replayed.
- All missing-configuration and verification failures fail closed.
- Automated tests exercise Firestore rules and the server endpoints; the release AAB is signed with the intended release key before store submission.


## PostgreSQL schema groundwork (staging only; not yet active in the app)

The migration at `migrations/001_coin_ledger.sql` defines:
- one authoritative non-negative balance row per Firebase UID;
- an append-only ledger with constrained transaction types;
- a per-user unique idempotency key to prevent replayed grants/settlements;
- optional reference IDs and JSON metadata for audit context.

**Staging database status (2026-10-29):**
- A Render PostgreSQL database named `klasik-tavla-ledger-test` was provisioned on the Free plan in Frankfurt, with an expiry date of 2026-11-28.
- The user connected from a local Windows machine using TLS 1.3.
- `migrations/001_coin_ledger.sql` was applied manually to this staging database.
- Verification confirmed the `public.coin_accounts` and `public.coin_ledger` tables exist and both contain zero rows.
- The database is temporary test infrastructure: it expires after the Render Free-plan period and must not be treated as durable production storage.

**Application integration status:** the app still has no PostgreSQL driver or `DATABASE_URL` configuration, and no economy endpoint reads or writes these tables. The current HTTP 503 guards must remain in place. Do not add staging credentials to source control, client code, logs, or chat. Before code integration, add a server-side PostgreSQL driver and lockfile entry, configure a secret `DATABASE_URL` on the staging server only, implement verified-UID-bound transactions with row locking and idempotency, and test against this staging database. Do not migrate live balances or enable production coin endpoints as part of this staging work.

## Do not do

Do not simply deny all user document writes in Firestore rules today: the current client still writes account creation, stats, progression, and coin transactions directly. Tightening those rules before the corresponding server operations are deployed will break existing flows. Keep the temporary 503 guards in place while the migration is completed.
