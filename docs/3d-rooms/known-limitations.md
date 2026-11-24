# Acceptance status and known limitations

This implementation is a functional **experimental** feature, disabled by default. Automated evidence is separate from manual release acceptance. No production deployment, service restart or destructive migration was performed.

| Requirement | Current evidence / status |
|---|---|
| Entry/exit in existing voice view | Implemented for desktop main and compact call views; existing control bar and ordinary call layout retained. Authenticated real-client switching/audio listening still needs manual acceptance. Mobile and popped-out call view excluded. |
| Local movement, camera, collisions | Browser WASD/focus/typing checks and shared/server geometry tests passed. Drag orbit, configurable sensitivity; deliberately no pointer lock, Escape releases focus. Flat-floor analytic collision only, no dynamic physics. |
| Remote avatars / 16-person capacity | Server authority, snapshots, gateway dispatch, interpolation implemented; simulations and native SQL 20-way admission race tested. Sixteen real networked clients not tested. |
| Avatar animation/persistence | 16 licensed skinned GLB models (14 Quaternius humanoid character presets across Masculine, Feminine, Fantasy/Sci-Fi + RobotExpressive and Fox), idle/walk/run/sit/wave clips, interactive seating ('E' to sit/stand at nearest chair/couch), visual AvatarSelectorModal with category filtering and equipped badges; migration v2 SQL preference test passed. |
| Spatial audio / mute / deafen | Existing audio chain reused; lifecycle/single-playback unit tests passed. Real headset stereo, mute/deafen/individual volume and audio-interruption tests remain open. |
| Screen sharing | Existing subscribed tracks reused as muted video textures on 16:9 monitor frames with idle display; synthetic source lifetime test passed. Actual multi-user share start/stop/fullscreen/audio sync remains open. Subscribe using normal voice controls first; at most four already-subscribed screens rendered. |
| Templates / permissions / room settings | Four cohesive 3D environments (Gaming Lounge, Meeting Room, Cinema Room, Social Rooftop with city skyline backdrop), interactive seating for up to 18 positions per room with auto-detection, config/capacity/spatial policy editor, existing channel permissions and audit. Real CC0 3D furniture models; graphics presets (Low, Standard, High). |
| Reconnect / cleanup | Expiry/replaced-session/generation policies and repeated Canvas cleanup tested. Actual provider reconnect/network flap and prolonged resource soak remain manual gates. |
| Feature flag | Server/default-off/auth tests; lazy app import. Requires PostgreSQL and existing cache; other database backends advertise disabled. |
| Type/lint/build | See testing.md and final validation report. No large production builds. Existing gateway single-module compile checked; running gateway not force-reloaded. |
| Windows desktop | Windows Chrome rendering verified; packaged Electron renderer and device/audio behavior not yet validated. |
| Performance | Fixture counters and local simulation documented; full CPU/GPU/voice/WAN benchmarks not claimed. |

## Transport and storage scope

Commands initially use existing authenticated HTTP with 10 Hz target; pushes reuse the current authenticated gateway (`ROOM_3D_UPDATE`). No dedicated new binary WebSocket movement opcode. Each command rechecks access/membership and takes a per-room SQL advisory lock around transient cache state. This prioritizes correctness and compatibility over unmeasured high-scale throughput. Higher room density needs profiling before changing the transport.

Configuration/avatar data uses an additive versioned native PostgreSQL namespace, following the existing economy precedent. Existing channel/user records are KV records, so no fake SQL foreign keys/cascades were added. Orphan settings are inert but automatic cleanup and audit retention are not implemented. No uploaded/arbitrary external avatars or environments are accepted.

Actual active user/account call testing cannot be inferred from a headless rendering fixture. Keep the flag off in production until the manual gates in testing.md have passed.
