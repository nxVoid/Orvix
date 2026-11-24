# Enable / disable and deployment

Disabled by default in every environment. This change does not modify Docker Compose, published ports, firewall, secrets or production flags. Keep the existing Relay/Orvix services and voice routes.

1. Install the updated workspace lockfile with the project's normal pnpm process. New renderer dependency is pinned `@react-three/fiber@9.8.1`; Three already existed. No new server or media provider.
2. Build/deploy API, app/desktop renderer and gateway through existing project procedures. New gateway atom/event is additive and unknown to old clients. For development, normal source watchers may suffice for API/app; Erlang still needs its normal reload/build procedure.
3. Set `ORVIX_3D_ROOMS_ENABLED=true` in the **API process environment**, explicitly in the deployment's existing environment mechanism. An arbitrary unexported shell/config variable is insufficient. Restart only the intended API process through normal operations; this implementation did not restart services automatically.
4. PostgreSQL must be the configured backend and the existing cache available. On first enabled authorized request, additive idempotent migration v1 creates the isolated `orvix_rooms_<kv hash>` namespace. The API database user needs CREATE SCHEMA/TABLE. For controlled migration, instantiate `RoomStore` with the existing initialized client/cache and call `migrate()` before enabling traffic.
5. Join an ordinary voice channel, then choose **Enter 3D Room** in the main desktop call view. Mute/deafen/share remain in the existing bottom controls. Returning leaves voice connected. Authorized room settings provide template, enabled status, capacity (1–16) and spatial policy. Avatar choice is durable.

Disable by removing the flag or setting it to anything other than `true` and recycling only the API through normal deployment. Affected 3D requests reject; ordinary voice is unchanged. No rollback migration deletes user settings. Keep the additive namespace during code rollback. No SQL DROP command is part of deployment; tests delete only their own randomly isolated test schema.

## Troubleshooting

- Button absent: feature capability false, non-PostgreSQL backend, mobile or popped-out call view; confirm authenticated GET `/rooms3d/capabilities`.
- ROOM_FULL: voice-only participation still works. A vanished client frees its slot after expiry/reconciliation.
- Access denied: inspect existing channel VIEW/CONNECT permission and the authoritative gateway voice connection; never bypass it with custom flags.
- Repeated 429: verify no duplicate scene/network loop; target 10 Hz, minimum 60 ms interval. Do not raise limits to mask duplicate loops.
- Reconnecting: inspect API/cache/PG/gateway health without logging admission/auth tokens. After expiry, the client rejoins automatically; a replaced session needs explicit retry.
- WebGL/context failure: return to ordinary voice; enable graphics acceleration in the existing desktop/browser settings, use low graphics and retry. The renderer never disconnects voice.
- Missing screen: subscribe/watch it through the ordinary voice UI first. 3D never circumvents stream permission/subscription policy. Select the virtual screen or Return to voice for the ordinary expanded viewer.
- Audio: switch spatial off or exit 3D to restore ordinary path; verify existing autoplay/mute/deafen/output selection first. No second LiveKit room should appear.

## Current local test activation

On 2026-11-11, the user requested activation for testing. The ignored root `.env.local` now sets `ORVIX_3D_ROOMS_ENABLED=true` for future development launches. The running development API and its watcher also have the flag enabled; the live capability function returned true. Only the compiled `event_atoms` allowlist module was hot-loaded into the existing gateway. No service or voice session was restarted. The temporary localhost-only Node debugger used for the runtime environment update was closed afterward. The actual Rspack RoomPanel/RoomScene JavaScript chunk returned HTTP 200 with no recent compile errors.

Refresh the development web client with Ctrl+Shift+R, join a voice channel, and choose Enter 3D Room. Removing the local override disables it on the next normal dev launch; the currently running process retains its flag until changed or recycled. Activation metadata and the prior gateway binary are in the ignored `.relay/runtime/rooms3d-test/` directory.
