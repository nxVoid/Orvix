# Orvix 3D Rooms

Experimental native 3D view for existing desktop voice channels. The current LiveKit voice session is reused; exiting 3D does not call voice disconnect. Disabled by default.

- [GitHub-first comparison](github-integration-analysis.md)
- [Repository audit and phase plan](architecture-audit.md)
- [Architecture and phase report](architecture.md)
- [Protocol](multiplayer-protocol.md)
- [Voice boundary](voice-adapter.md) / [spatial presentation](spatial-audio.md)
- [Security](security.md)
- [Setup and flag](deployment.md)
- [Tests](testing.md) / [performance](performance.md)
- [Explicit acceptance limits](known-limitations.md)
- [Actual scene screenshot](previews/gaming-lounge.png)

## Changed file map

`relay_api/src/api/rooms3d/`: service, storage/migration, API and targeted tests. Registration in `api/app/ControllerRegistry.ts`; gateway event type in `api/constants/Gateway.ts` and Erlang allowlist `relay_gateway/src/utils/event_atoms.erl`.

`packages/schema/src/domains/rooms3d/`: strict shared contracts and scene/movement geometry.

`relay_app/src/features/rooms3d/`: lazy entry, isolated error boundaries, room/settings UI, scene/avatar/virtual screen, provider-neutral interface, LiveKit observation/spatial adapter and gateway listener. Shared room controls and a native cube button in `features/voice/components/VoiceControlBar.tsx`, with integration in compact voice calls and `features/voice/components/VoiceCallView.tsx` and `features/gateway/events/EventRouter.ts`. App manifest/lock add pinned R3F; existing Rspack asset rule adds GLB.

`tools/relay/build-room-avatar.py`: original GLB source builder. `tools/relay/check-3d-rooms.cjs` and `docs/3d-rooms/tests/`: reproducible isolated browser/adapter checks. Existing cosmetics, RP, premium and networking changes retained.
