# Architecture audit and implementation plan

2026-11-11; root `/home/ufukw/projects/Orvix`, container `/workspaces/orvix`.

## Baseline and preservation

Git status recorded at `/tmp/orvix-3d-initial-status`: 16,006 already modified tracked paths. Preserve rebrand, economy, cosmetics and networking work. No resets, commits, migrations on existing records or service restarts. No Nexora changes. Docker inspection found Relay workspace, PostgreSQL, Valkey, LiveKit, NATS, Meilisearch and Mailpit running. Historical ports are not assumed deployment contracts.

Baseline targeted Vitest: `StudioMotionBudget.test.ts` and `EconomyAccess.test.ts`, 4 tests passed. First attempted nonexistent `EconomyPolicy.test.ts` returned no tests and is not counted as a pass. Full application checks will be sequential due memory limits.

## Verified integration points

- pnpm workspace: `pnpm-workspace.yaml`; app `relay_app/package.json`, React 19.3.1, Three 0.186.1 already present. No 3D room feature found in the voice directory.
- Native voice surface: `relay_app/src/features/voice/components/VoiceCallView.tsx`, keeps `VoiceControlBar` and screen-view UI mounted/available.
- Session owner: `features/voice/engine/MediaEngineFacade.ts` exposes current `room`, channel and participant state. Existing `engine/v2/VoiceEngineV2AppConnectionHostAdapter.ts` alone owns provider connection.
- Track ownership/subscriptions: `VoiceEngineV2AppSubscriptionAdapter.ts`, `VoiceEngineV2AppScreenShareExecutionAdapter.tsx`, room event binder. No new capture or publication.
- Single audio preference authority: `features/voice/state/ParticipantVolume.ts` composes output/user/connection volumes, local mute and effective deafen. Spatial presentation must extend this path, never attach second audio elements.
- Gateway authority: `relay_api/src/api/infrastructure/GatewayService.ts#getVoiceStatesForChannel`, authenticated channel access in `channel/services/channel_data/ChannelAuthService.ts`. Recheck access and CONNECT permission; settings require MANAGE_CHANNELS (DM ownership otherwise).
- API: Hono, `app/ControllerRegistry.ts`, AuthMiddleware, Validator and RateLimitMiddleware. New routes use existing session/token transport (`platform/transport/RestTransport.ts`).
- DB: configured PostgreSQL, most legacy entities use Cassandra DSL translated to JSONB KV. Existing dedicated economy tables establish native SQL precedent. Reuse `relay_api/pkgs/postgres/src/Client.ts`; additive versioned room schema isolated by KV namespace, no destructive DDL. Valkey `pkgs/cache/src/ICacheService.ts` provides ephemeral snapshot storage; no movement history stored in SQL.
- Schemas: `packages/schema/src/domains`, Zod; shared finite-number and approved-preset contracts.
- Desktop: existing renderer consumes same React surface; WebGL needs desktop validation. No native Electron privilege or CSP expansion required for local geometry.
- Localization: Lingui macros; new actionable controls follow these conventions.
- Tests: API Vitest can exercise shared pure client policies; isolated PostgreSQL tests use unique schemas. No browser automation package assumed.

## Implementation order / file scope

1. `packages/schema/src/domains/rooms3d/`: strict protocol, room geometry and validation; `features/rooms3d/`: lazy R3F scene, camera, movement and fallback. Add small native voice-view entry point.
2. `relay_api/src/api/rooms3d/`: additive configuration/preferences schema, authenticated route service, cross-worker capacity and movement authority, transient snapshots in cache. Shared protocol avoids new gateway opcodes.
3. `SpatialVoiceAdapter.ts` and LiveKit adapter: observe existing session; integrate attenuation into ParticipantVolume's existing preference path; never reconnect or duplicate playback.
4. Virtual screens consume only already subscribed video tracks. No unsolicited subscriptions/capture.
5. Three room templates, bounded approved avatar presets, permission-gated settings and durable preferences.
6. Security, lifecycle, 16-client simulations, targeted type/lint checks, browser rendering evidence and documented limits.

## Risks / decisions

Feature remains disabled unless `ORVIX_3D_ROOMS_ENABLED=true`. Capability endpoint gates lazy renderer loading; disabling leaves voice unchanged. HTTP polling is compatible with existing authenticated transport but has more overhead than an Erlang gateway opcode. A 16-client simulation is not a 16-machine WAN or Windows audio regression test. Existing screen-share privacy/subscription policy must remain authoritative. Initial procedural avatars are explicitly not licensed GLB character assets; richer animation assets remain a separate approved-catalog extension. No upstream remote configuration changed; local upstream compatibility is preserved by additive files and one registration/view hook, without claiming an unperformed upstream merge audit.
