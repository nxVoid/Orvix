# Relay Points, Cosmetics and Missions

## Discovery (2026-11-11)

The API is Hono/TypeScript. Controllers register in `relay_api/src/api/app/ControllerRegistry.ts`; authentication, schema validation, rate limiting and admin ACL middleware already exist. Web and desktop share `relay_app`; Flutter in `relay_mobile` is a separate client. Shared wire schemas live in `packages/schema`.

The development configuration selects PostgreSQL, but existing domain repositories use CassandraTableDsl and the PostgreSQL JSONB KV executor (`orvix_kv`). Its conditional batches deliberately require one logical table and one partition. This is not a relational users table and cannot atomically debit a wallet, grant ownership and decrement global stock across partitions. Do not weaken that constraint. The existing `@pkgs/postgres` pool exposes real transactions and supports additive relational tables alongside KV data.

Premium authority is `User.isPremium()` / `checkIsPremium`: paid entitlement, expiry/grace, overrides, perks-disabled and self-hosted policy. Stripe, Apple and Google entitlement writers already reconcile users. Economy must read this authority, never create subscriptions or use client premium flags. Existing profile avatars/banners and animated-asset entitlements remain intact.

Admin uses explicit `AdminACLs`, `requireAdminACL`, audit recorder and the Rust `relay_admin` UI. Existing storage services handle S3-compatible media; `relay_static` serves bundled public assets. Economy assets are public, ownership and equip authorization are private server records. Uploaded assets must reuse the verified media upload path; arbitrary SVG/HTML must never be inserted inline.

MessageSendService has a persisted-success path suitable for a human-only mission hook; webhook/bot sends must not count. Signed LiveKit webhooks validate server/room ownership. Voice rewards require server SFU evidence and bounded consecutive observations, not client duration, connection duration alone, or P2P reports.

`docs/references/spark/Relay_Cosmetics_Workspace/catalog.json` contains 12 original Relay assets (5 frames, 4 banners, 3 nameplates). Reuse these SVG files, not reference screenshots or Spark branding. Ship nonanimated alternatives for reduced motion.

## Implementation plan

1. Add isolated, versioned PostgreSQL economy migrations through the existing pool, without changing existing KV rows. Economy fails closed on Cassandra until a transactional implementation exists. No automatic conversion of existing users or balances.
2. Wallet, append-only transaction ledger, operation receipts, ownership, category equip slots, catalog, collections, mission definitions/progress/claims/activity and audit tables. Wallet creation is lazy. RP are bounded integers. Foreign keys cover economy-owned tables; user IDs are logical references to existing KV users, checked through authenticated server models.
3. Serialize per-user mutations with wallet row locks. Purchases additionally lock catalog stock. Unique operation keys and request fingerprints replay committed results and reject key reuse for another operation. Ledger, ownership, stock and receipt commit together. Reasons and actor IDs are mandatory for administrative changes. Refunds reference original debit and cannot exceed it.
4. Authenticated API with server prices, stock, sale windows, premium checks, per-user reads, rate limits and bounded pagination. Separate read/catalog/mission/adjust permissions for admins. No public mint endpoint.
5. Shared web/desktop shop with categories, previews, purchase confirmation, inventory, equip, missions, transaction history and existing premium link. Use theme-aware isolated purple surfaces, keyboard focus, accessible dialogs and reduced motion. Extend public profile rendering without trusting local storage.
6. Mission UTC daily/weekly periods, immutable claim receipts, daily reward caps and configurable definitions. Trusted events deduplicated by source ID; meaningful-message normalization, repetition and cooldown controls; deletions must invalidate unclaimed message credit. Voice rewards remain unavailable unless server activity can be verified. Campaign participation is administrator/server-attested.
7. Add management UI using existing admin authorization and upload infrastructure. Extend Flutter models/UI without breaking old clients; unknown categories are ignored safely.
8. Targeted unit and isolated PostgreSQL concurrency tests, client type checks and mobile checks. Never run the entire build farm.

## Invariants and risks

- Never create negative balances, issue client-supplied awards, or count an event/claim twice. Lock order: user wallet, operation receipt, catalog (single item). Admin edits must honor the same stock row lock.
- Catalog edits do not rewrite purchase receipts. Removing publication does not remove ownership. Premium expiry filters active cosmetics at read/render time; ownership survives.
- Period/reward definitions are snapshotted for claims; changing a mission must not retroactively increase completed rewards. Daily caps serialize under the wallet lock. UTC reset uses half-open periods, Monday weeks.
- KV user deletion has no SQL foreign key; economy data retention/anonymization needs explicit integration with account deletion rather than cascading against a nonexistent SQL users table.
- Never acknowledge mission progress before durable persistence. Avoid blocking message delivery on a reward side effect: use a durable retry/outbox path or explicitly report unavailable progress; do not silently lose events.
- Browser rendering cannot use async DB lookups per avatar. Profile snapshots/cache invalidation must be bounded and update on equip and entitlement changes. Secure server filtering takes priority over stale cosmetic appearance.
- Voice SFU connection is not proof of active speech; require eligible peers, valid membership, non-AFK/nonbot and actual microphone activity. Remote media tunnel limitations remain separate from economy.
- SMIL SVG animation ignores CSS pause; reduced motion must select a separate static file.
- No production claim until integration/concurrency checks pass. Keep incomplete event producers disabled rather than awarding unverifiable RP.

## Migration and rollback

Use a dedicated `relay_economy` schema and migration version table, transaction-scoped advisory lock, additive SQL and checks. Existing database initialization remains unchanged. Deployment rollback disables new routes/hooks and rolls back application code; retain economy tables and ledger. Do not run DROP, truncate, reset, volume removal or data migration against existing users. Test schemas are uniquely named and isolated.

## Delivery verification

Record actual commands/results and outstanding platform tests here as phases complete. Real Android/desktop and external payment/production HTTPS checks require those clients; do not report browser or unit tests as device validation.

## Delivered in this iteration

| Phase | Files and behavior |
| --- | --- |
| Discovery | This document records the PostgreSQL KV adapter, existing Premium entitlement, user profile model, storage and admin ACLs. |
| Economy API | `relay_api/src/api/economy/` contains the additive SQL migration, wallet, ledger, idempotent receipts, stock, ownership, equip slots, claims and audit. Use `/api/v1/economy/catalog`, `wallet`, `inventory`, `history`, `purchase`, `equipped`, `missions` and `claim`. Admin API is under `/api/v1/admin/economy`. |
| Clients | `relay_app/src/features/economy/` and `relay_mobile/lib/features/economy/` expose Settings → Relay Points. Web and desktop share the store. Flutter uses the active instance's authenticated Dio client. Profile responses have an optional cosmetics array. Web and desktop display frames and nameplates in shared avatar and message surfaces. Flutter profile and profile popout display static banners and frames. |
| Missions | AuthSession and MessageSendService write trusted login and message events. Standard and bulk message deletion revoke unclaimed credit. Claims also verify persisted source messages, including edits and deletes through other paths. Admin can attest attendance for one configured campaign mission. Gateway invalidation refreshes open panels, with periodic mission polling when the gateway event is unavailable. |
| Premium | Catalog purchase, equip, active projections and claim bonus use the current `User.isPremium()` authority. Premium loss hides active premium items while ownership remains available in inventory. |
| Admin | `relay_admin/src/routes/economy.rs` uses the existing admin session and CSRF protection. `economy:read` opens the panel, `economy:catalog` manages products and uploads, `economy:missions` manages definitions and attendance, and `economy:adjust` manages adjustments, refunds and daily caps. Editors use validated JSON forms. Uploads decode bounded PNG, JPEG or static WebP input and store a normalized WebP in the existing CDN bucket. |
| Artwork | `tools/relay/generate-economy-assets.py` validates and embeds the 12 original SVGs from the reference workspace and emits 12 static variants. Re-run it when the supplied vector artwork changes. |

The runtime applies migrations on the first authenticated economy use or eligible activity. PostgreSQL deployments using a nondefault KV table get a distinct economy schema. Migration 2 adds slot and refund constraints and updates only unowned, unmodified starter listings. The migration role needs permission to create the adjunct schema. Production backup policies should cover it alongside the KV schema.

A purchase request includes the displayed price as a precondition. The server uses the locked catalog row as the actual price. Retrying a mutation with the same key and request returns its receipt. Refunding a purchase returns its full debit, removes its current ownership and equip slot, and restores one stock unit. Lifetime spent is gross purchase spend. UTC daily caps cover claimed mission rewards.

## Open verification and implementation gaps

- Voice definitions are seeded disabled. The current LiveKit service proves participant membership and publication state. It lacks an authoritative active media observation that distinguishes AFK from eligible activity. Voice seconds are not credited from client payloads or room duration.
- Economy event writes run after core sign-in or message persistence. If the economy database write fails, the core request still succeeds and the failure is logged. A durable replay path for this cross-operation gap remains to be implemented.
- Mobile uses static SVG/WebP artwork and does not apply cosmetic effects to every chat or friend-list row. Some catalog categories still need specialized rendering. Real-device layout, gateway delivery after rebuilding the Erlang gateway, and the Rust admin UI in a browser need end-to-end verification.
- Account-deletion integration for retention or anonymization of economy records and a Cassandra transaction adapter remain open. Restrict database privileges and choose retention before production rollout.

## Verification

- API policy, authorization and PostgreSQL transactions passed 13 tests across two focused Vitest files. The PostgreSQL tests create and remove only their unique `relay_economy_test_*` schema. They cover insufficient balance, price changes, duplicate purchase and reward, concurrent purchases and stock, ownership, equip, premium expiry, refund, admin ACLs, UTC reset, cap, spam cooldown, deleted sources and scoped campaign attestation.
- API and web type checks passed with a bounded Node heap. The workspace's Biome configuration was applied to the 34 touched TypeScript and CSS files in an isolated lint directory because of the nested mobile Biome root.
- `cargo check -p relay_admin --offline --locked` passed with one build job.
- Targeted Flutter analysis passed across 10 changed app files. Two Flutter widget tests passed at 360 and 1100 logical pixels. They exercise catalog loading, confirmation before debit, wallet refresh and equip.
- Local HTTP smoke checks returned 200 for a bundled static SVG and 401 for unauthenticated catalog and admin requests.
- The Erlang event name compiled and resolved to `economy_update` in a standalone module check.
- The Relay development PostgreSQL instance reports economy migrations 1 and 2 and 12 published cosmetics. The migration updated only the economy schema.
