# Recovery storage compatibility repair

## Cause and scope

The Fluxer-to-Orvix text replacement renamed PostgreSQL's persisted JSON type
marker from `__fluxer_type` to `__orvix_type`. This marker also appears inside
serialized primary and partition keys. Consequently, new lookups missed old
records, and old BigInt fields decoded as objects. Constructing a `User` then
failed in `extractPremiumFlagsFromLegacyUserFlags` with the reported BigInt error.
This is a storage protocol change, not a recovery-key hashing change.

The canonical writer again uses the original marker. TypeScript and Rust readers
accept both markers. Schema migration markers also retain their original
`__fluxer_schema_migrations` identity. These internal names must never be rebranded;
`tools/rebrand_orvix.py` now protects them. Physical database/table names remain
unchanged.

## Recovery flow reviewed

- `relay_api/src/api/auth/AuthRecoveryKit.ts`: 20 cryptographically random bytes,
  32 Crockford Base32 characters, SHA-256 of the canonical unformatted key,
  timing-safe comparison, rate limits, password checks, MFA, atomic rotation and
  rollback. No branding constant or application secret participates in the hash.
- `packages/constants/src/RecoveryKeyUtils.ts`: case folding, permitted whitespace
  and dash removal, and Crockford O/0 and I/L/1 aliases. No normalization change.
- `relay_api/src/api/auth/services/RecoveryKitRepository.ts`: per-user persistence
  and compare-and-swap replacement. Used/replaced/revoked kits stay invalid.
- `relay_api/src/api/user/UniqueUsernames.ts`: trimmed, case-insensitive usernames,
  optional discriminator, ambiguity/bot/deleted-user rejection.
- `relay_api/src/api/auth/AuthController.ts`, `AuthPassword.ts`, and
  `packages/schema/src/domains/auth/AuthSchemas.ts`: request validation, generic
  credential errors, Argon2 password update and session/reset-token revocation.
- `relay_app/src/features/auth/components/pages/RecoverAccountPage.tsx` and
  `AuthFlow.ts`: submitted username/key, instance selection and MFA continuation.
- `relay_app/src/features/auth/components/modals/RecoveryKitModal.tsx` and
  `features/auth/utils/RecoveryKitSheet.ts`: PDF prints the issued key; it does not
  generate a different one. QR/link parameters are read from the URL fragment.

There is no age-based expiration policy for recovery kits. Existing active older
kits remain valid; expired database TTL rows, revoked kits and consumed keys fail.
Changing the dummy recovery hash's brand does not affect real keys.

## Migration procedure

Stop **all Orvix API, worker and Rust service writers** first. A development
supervisor accepts SIGTERM and gracefully stops its children. Identify its current
PID; do not copy a historical PID. Leave PostgreSQL, Docker volumes and unrelated
projects alone. Make a fresh protected backup:

```sh
umask 077
docker exec relay-dev-postgres-1 pg_dump -U fluxer -d fluxer -Fc > /private/path/orvix-before-storage.dump
```

Inside the existing workspace container, from `/workspaces/orvix/relay_api`:

```sh
pnpm exec tsx scripts/MigrateRebrandedKvStorage.ts --development
# Only if the dry run identifies the activity-only shadows described below:
pnpm exec tsx scripts/MigrateRebrandedKvStorage.ts --development --repair-activity-shadows
# Apply the reviewed plan while all writers remain stopped:
pnpm exec tsx scripts/MigrateRebrandedKvStorage.ts --development --repair-activity-shadows --apply --writers-stopped
```

Without `--development`, the utility uses the deployment's existing environment.
The development option loads development/local files without overriding explicit
process environment values. When running from the WSL host instead of the
container, use `ORVIX_POSTGRES_HOST=127.0.0.1` for the published database port.

The migration runs in one transaction, locks writers, normalizes typed envelopes
and serialized keys, preserves ordinary strings, and rejects ambiguous data or
canonical-key collisions. It refuses databases above 100,000 rows rather than
partially migrating. Large deployments need a separately reviewed migration.
It does not change recovery/password hashes, account IDs, creation timestamps or
kit expiry. Re-running after successful application plans zero changes.

The optional activity repair only accepts an incomplete user row containing
`user_id`, `last_active_at`, and optionally an identical `last_active_ip`, paired
with a complete profile for the same user. It also accepts otherwise identical
rows in the two last-active-IP indexes. It keeps the complete profile and the
newest activity timestamp. Full-profile, recovery-record, security-field, expiry
or unrelated conflicts still abort. Both originals are preserved as JSON text
in logical table `__orvix_rebrand_activity_archive_v1`; no rows are deleted.
The PostgreSQL dump additionally preserves all original timestamp precision.

## Applied to this development database

Backup: `.orvix/recovery-debug/before-storage-compat.dump`, owner-only permissions.
Migration: 329 rows scanned, 36 updated, 3 activity collisions archived, total
329 rows retained. There are two complete users and two active recovery records;
the extra pre-repair user row was an incomplete activity shadow of an existing ID.
Both kit hashes have the expected SHA-256 hex format and refer to existing users.
Protected before/after checks confirmed unchanged recovery hashes, kit creation/
expiry/update timestamps, usernames, password hashes, email and MFA types.
A second dry run reported zero changes. No passwords were reset and no kits
were issued, revoked or rotated in the real database during this repair.

## Validation and restart

Files changed for this repair:

- `relay_api/src/api/database/PostgresKvCodec.ts` and `PostgresKvQueryExecutor.ts`
- `relay_api/src/api/database/PostgresKvRebrandMigration.ts`
- `relay_api/scripts/MigrateRebrandedKvStorage.ts` and `RecoveryStorageEnvironment.ts`
- `relay_api/src/api/jobs/PostgresJobLedgerExpiry.ts`
- `relay_svc/src/postgres.rs` and `relay_users/src/app_attest/store.rs`
- `relay_api/src/api/auth/tests/RecoveryKitPostgres.test.ts`
- `relay_api/src/api/database/PostgresKvCodec.test.ts` and `PostgresKvRustParity.test.ts`
- `tools/rebrand_orvix.py` and this report

Validation passed: 85 API/storage tests, 10 recovery-format tests, four Rust
PostgreSQL tests, API TypeScript checking and API build, Rust users checking,
and Biome checking of all nine changed TypeScript files. The rebranding utility
also passed three assertions preserving wire identifiers while renaming product
names. A read-only application-level audit loaded both real users with BigInt
flags and found both corresponding recovery records. No owner key was submitted
to the real password-reset endpoint. A synthetic unauthenticated request through
the public proxy reached the real recovery endpoint and received HTTP 400
`CAPTCHA_REQUIRED`; CAPTCHA and origin checks remain enforced.

```sh
ORVIX_RECOVERY_POSTGRES_TEST=1 pnpm --filter relay_api exec vitest run \
  src/api/auth/tests/RecoveryKitPostgres.test.ts \
  src/api/auth/tests/RecoveryKit.test.ts \
  src/api/database/PostgresKvCodec.test.ts \
  src/api/database/PostgresKvRustParity.test.ts \
  src/api/database/PostgresKvQueryPlan.test.ts \
  src/api/database/PostgresKvExactnessFuzz.test.ts --maxWorkers=1
pnpm --filter @relay/constants exec vitest run src/RecoveryKeyUtils.test.ts
pnpm --filter relay_api typecheck
pnpm --filter relay_api build
CARGO_BUILD_JOBS=1 cargo test -p relay-svc postgres::tests --lib
CARGO_BUILD_JOBS=1 cargo check -p relay-users
```

The opt-in PostgreSQL suite creates a connection-local TEMP table; it does not
modify live account tables. It covers recovery, incorrect credentials, formatting,
legacy kits/users, expired/revoked/reused keys, password reset, session revocation,
rotation, BigInt flags, migration preservation/idempotence, collision rollback,
and activity-shadow preservation. MFA/rate-limit/rollback coverage remains in
the existing recovery suite.

Rebuild the Rust writers before serving requests. With no development supervisor
already running, start the usual environment:

```sh
docker exec -it -w /workspaces/orvix relay-dev-workspace-1 pnpm dev
```

Open `http://localhost:8088`. Do not start a second supervisor on occupied ports.
No Compose teardown, database reset, volume removal or Nexora changes are needed.

## Owner verification

The actual PDF key was not provided, so visual equality to the PDF has not been
treated as proof that it matches the active stored hash. On the correct current
instance, open its recovery page and privately enter the kit's username/key and a
strong new password. Complete MFA if required. A successful recovery must show a
new kit: save it immediately, confirm login, then verify the old key fails.
Never share either key or place it in command arguments, screenshots or logs.
Use the current instance URL if an old PDF's link points to a retired hostname.
This repair cannot restore a key already replaced or revoked, nor prove the
authenticity of an old PDF without its owner's private verification.
