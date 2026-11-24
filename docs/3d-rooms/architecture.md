# Orvix 3D Rooms architecture

The existing voice channel remains the session authority. `VoiceCallView.tsx` mounts a small capability/entry component on desktop; the R3F renderer, model and voice presentation adapter are dynamically imported only after entering an enabled room. The ordinary voice layout remains mounted beneath the 3D surface, and its control bar remains outside that surface. Returning unmounts only 3D resources.

## Boundaries

- **Voice/channel:** existing authentication, channel authorization, gateway voice membership, media engine, moderation, screen subscriptions and mute/deafen controls.
- **Client:** `relay_app/src/features/rooms3d/`; R3F Canvas, Three GLTFLoader/AnimationMixer, OrbitControls, predicted local movement, interpolated remote movement, 16 approved bundled skinned GLBs (14 diverse Quaternius humanoid character presets across Masculine, Feminine, Fantasy/Sci-Fi + RobotExpressive and Fox), 18 named catalog presets, visual `AvatarSelectorModal`, interactive seating ('E' to sit/stand at nearest chair/couch), graphics presets (Low/Standard/High), four cohesive 3D environments (`RoomEnvironments.tsx`: Gaming Lounge, Meeting Room, Cinema Room, Social Rooftop), and per-participant SkeletonUtils clones.
- **Authority:** `relay_api/src/api/rooms3d/`; authenticated Hono routes, current CONNECT/visibility checks, gateway-owned voice connection validation on every update, 16-person capacity, authoritative sit state handling, and bounded motion integration.
- **Ephemeral realtime:** existing cache/Valkey stores bounded room state for ten seconds. Presence expires after five seconds without a heartbeat and is filtered against current gateway membership on every exchange. No movement history is written to SQL. One PostgreSQL transaction advisory lock per room serializes updates across API workers without expiring lease races.
- **Durability:** isolated `orvix_rooms_<sha256(kvTable)[0:16]>` PostgreSQL schema, configuration by channel PK, avatar choice by user PK, append-only settings audit, migration version 2 (supporting all 18 avatar IDs in check constraint). User/channel records live in the existing KV schema; there are no fictitious relational foreign keys to them. Every API operation rechecks the existing entity/access. Deleted-channel configs are inert; automatic orphan maintenance is not implemented.
- **Delivery:** HTTP uses the current authenticated REST client for join, movement commands and recovery snapshots. Coalesced authoritative `ROOM_3D_UPDATE` snapshots are delivered over the existing authenticated gateway to admitted room users' own sessions. No second WebSocket server or voice infrastructure.

## Rendering

Gaming lounge, meeting, cinema and social rooftop layouts share the exact analytic obstacle and seating definitions used by the server (`RoomGeometry.ts`). Flat-floor AABB/circle clearance replaces an unnecessary rigid-body engine. WASD input is canvas-focus-only; entering text fields, Escape, tab hiding and window blur clear movement. Orbit drag uses no pointer lock. Camera sensitivity, seat interaction prompt ('E'), and low/standard/high graphics presets (dpr, soft shadows) are available. Reduced-motion changes pause ambient idle animation while retaining walking/running animation to communicate movement.

Approved models map their actual idle/walk/run/sit/wave clips through AvatarAnimationPlayer. Local locomotion reads input immediately instead of waiting for a server echo. Renderer-owned geometry/textures and per-instance mixers/materials are cleaned up; one small loader cache is bounded and shared. A graphics boundary/context-loss guard reports failure without touching voice. Renderer monitoring can report draw calls, triangles, geometry/texture counts and RAF p95; this is not GPU timer-query profiling.

## Configurations and moderation

Guild access inherits VIEW_CHANNEL and CONNECT through existing channel auth and permission checks. MANAGE_CHANNELS gates configuration, template, capacity and spatial-audio policy changes. DM configuration changes require its existing owner. Private-channel rules remain the privacy mechanism. Configuration writes are audited, invalidate old 3D sessions and cause active users to rejoin; ordinary voice remains connected. The existing voice moderation UI stays available after returning from 3D; no parallel ban/role system is introduced.

## Phase report

1. Foundation: Room3dEntry, RoomPanel, RoomScene, ApprovedAvatar and small voice-view integration; browser fixture verified movement, focus isolation, view cleanup and graphics failure.
2. Presence: RoomSession/RoomStore/shared schemas and gateway delivery; mock simulation, real SQL capacity race and authenticated API access tests.
3. Voice: provider-neutral SpatialVoiceAdapter and LiveKit implementation; lifecycle/single-playback unit coverage. Actual two-machine voice regression remains a release gate.
4. Screens: already-subscribed video tracks become muted VideoTextures; native viewer return keeps the ordinary screen-sharing controls/subscriptions intact. Actual simultaneous shared-screen regression remains a release gate.
5. Configuration/avatar: durable settings, approved avatar choice, templates, audit and permission tests.
6. Validation: automated evidence in testing/performance docs. Production flag remains off. This is a functional experimental implementation, not a claim that every production acceptance gate has passed.
