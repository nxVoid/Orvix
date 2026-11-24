# Tests and reproducible checks

Run commands from repository root. The currently inspected development container is `orvix-dev-workspace-1`; verify its name rather than assuming it elsewhere. No complete application builds are required.

## Server / shared geometry / existing voice regressions

```sh
docker exec -w /workspaces/orvix/relay_api \
  -e API_TEST_MAX_WORKERS=1 -e ORVIX_ROOMS_POSTGRES_TEST=1 \
  orvix-dev-workspace-1 ./node_modules/.bin/vitest run \
  src/api/rooms3d \
  src/api/voice/tests/VoiceLivekitEndpoint.test.ts \
  src/api/voice/tests/VoiceRegionSelection.test.ts \
  src/api/voice/tests/VoiceP2pGrant.test.ts --reporter=dot
```

Native SQL tests read the existing development PostgreSQL connection configuration inside the process, create a randomly isolated test namespace and delete **only that namespace** afterward. `ORVIX_ROOMS_TEST_PG_HOST` overrides Docker hostname `postgres`. They do not migrate or reset actual user data. Without `ORVIX_ROOMS_POSTGRES_TEST=1`, native SQL tests are explicitly skipped.

Cases: finite/schema bounds, collision and diagonal speed, interpolation/attenuation, 16/20 admission race, independent rooms, stripped admission tokens, stale/fast packets, expired/replaced sessions, revoked membership, broadcast coalescing, flag-off/auth checks, real permission checks, API identity spoof/body limits, SQL persistence/idempotent migration and real advisory lock race.

## Browser-specific adapter/gateway unit tests

```sh
docker exec -w /workspaces/orvix/relay_app orvix-dev-workspace-1 \
  ../relay_api/node_modules/.bin/vitest run \
  --config ../docs/3d-rooms/tests/vitest.config.mts --reporter=dot
```

These live outside the API compiler's non-DOM type universe. Test the actual browser adapter with an existing-room/track fixture, plugin ownership, no new voice connect/capture/playback, disposal, own listener cleanup, scoped gateway delivery and stale generation/revision policy. They do not prove audible device behavior.

## Type and lint checks

Run API and app `../node_modules/.bin/tsc --noEmit` sequentially from their package roots inside the workspace container, using `NODE_OPTIONS=--max-old-space-size=3584` for each. Lower 2 GB limits previously exhausted memory; do not run both compilers together.

Generate only the new CSS declaration with the installed tsx/typed-css-modules:

```sh
cd relay_app
./node_modules/.bin/tsx -e "import {run} from 'typed-css-modules'; run('src/features/rooms3d', {pattern:'**/*.module.css'}).catch(e => {console.error(e);process.exitCode=1});"
```

Biome's normal root scan encounters an existing nested Flutter root. During this work the repository's current Biome configuration and lint plugin were copied to an isolated temporary root, only the exact feature/integration files were checked, and only those files were copied back. Do not rewrite unrelated files to fix the nested-root issue. Erlang allowlist check: `ERL_FLAGS='+S 1' erlc -o /tmp/orvix-3d-erl relay_gateway/src/utils/event_atoms.erl` after creating that temporary directory. No full Rust/Erlang/application build.

## Isolated Windows Chrome rendering fixture

Build the same scene module into ignored runtime artifacts:

```sh
mkdir -p .relay/runtime/rooms3d-preview/assets
cp relay_app/src/features/rooms3d/assets/orvix-guide.glb .relay/runtime/rooms3d-preview/assets/
docker exec -w /workspaces/orvix/relay_app orvix-dev-workspace-1 \
  ./node_modules/.bin/esbuild ../docs/3d-rooms/tests/browser-fixture.tsx \
  --bundle --format=esm --jsx=automatic \
  --alias:@relay/schema=/workspaces/orvix/packages/schema \
  --outfile=../.relay/runtime/rooms3d-preview/fixture.js \
  --define:process.env.NODE_ENV='"development"'
```

Use a minimal `index.html` with `#root` and module script `fixture.js`, then serve the repository read-only on local port 18755 (`python3 -m http.server 18755 --bind 127.0.0.1`). Run `tools/relay/check-3d-rooms.cjs` using Windows Node; it starts an isolated temporary Chrome profile/CDP port and closes only its owned browser. No existing browser profile or real account credentials are used. Results/screenshots go to Windows temporary directory; checked-in evidence is under `previews/`. This fixture never connects to real voice/API/users. Its synthetic canvas video validates VideoTexture lifecycle while retaining the source track; it is not a new product screen capture path.

## Manual release gates

Two authenticated real clients in a real channel: enter/exit repeatedly; mute, server mute, deafen, user/connection volume, voice-only peer, microphone device switch, provider reconnect, native screen sharing/start/stop/full-screen, cross-channel navigation/kick/private permission removal. Then 16 real networked users, Windows desktop packaged renderer and extended GPU/CPU/audio interruption profiling. These are not recorded as passed without actual evidence. See known-limitations.md.

## Final recorded results

- API/shared/SQL/authorization plus existing endpoint/region/P2P voice regression selection: **43/43 passed**, seven test files. SQL tests explicitly enabled; no skips in this selection.
- Browser-specific adapter, gateway, animation, avatar and environment assets suites: **33/33 passed**, five files (`AvatarAssets.test.ts`, `AvatarAnimation.test.ts`, `SpatialVoiceAdapter.test.ts`, `RoomGateway.test.ts`, `EnvironmentAssets.test.ts`).
- Full API TypeScript check: passed (0 errors). Full app TypeScript check: passed with 0 errors (`NODE_OPTIONS=--max-old-space-size=3584 ../node_modules/.bin/tsc --noEmit`).
- Scoped Biome: checked, no remaining errors. Erlang `event_atoms.erl` compiled successfully into a temporary directory.
- Windows Chrome fixture: movement/typing isolation passed; all four room templates rendered (`gaming`, `meeting`, `cinema`, `rooftop`); three exit/re-entry cycles retained the source video track; context-loss recovery signal passed; initial graphics failure false. Stored results and screenshot are under `docs/3d-rooms/previews/`.
- Initial failures corrected during development: duplicate body-limit readers, browser-only tests entering the backend DOM-free type graph, and initially empty generated CSS declaration. None are reported as passes before correction.

These checks are not a production end-to-end voice/desktop certification. The manual gates above remain open.

## Compact-call entry regression fix

The initial entry was mounted only in the expanded VoiceCallView, while ordinary DM and guild calls normally use CompactVoiceCallViewInner. The entry is now also mounted in the live desktop compact content area. Entering uses that surface's existing fullscreen API without changing channel/voice membership; returning closes only fullscreen owned by the 3D entry. Capability checks refresh on window focus and every 15 seconds, so activating the development flag after mounting no longer leaves an old false result indefinitely.

`entry-fixture.tsx` exercises the actual entry component with isolated transport/localization/panel boundaries (`node docs/3d-rooms/tests/build-entry-fixture.cjs` from repository root). Windows Chrome checks cover disabled hiding, focus refresh after enabling, entry callback/lazy panel opening and exit back to the entry button. The real Rspack boot-app asset was checked to contain the compact integration. This is an entry/UI regression check, not a real-user voice media test.

## Voice toolbar placement

The floating top-left entry button has been removed. A channel-scoped Room3dProvider now shares entry state between the content surface and the existing VoiceControlBar in compact and expanded call views. Room3dControlButton sits immediately after screen sharing, reusing the existing button/icon/active-state CSS, FocusRing and Tooltip. It toggles 3D without changing media controls or opening another voice session.

The updated entry fixture renders the real provider, entry surface and toolbar button, stubbing only transport/localization/tooltips and the heavy room panel. Windows Chrome passed seven checks: disabled hiding, focus refresh, placement inside controls, exact reference-control dimensions, no absolute positioning, actual mouse-click opening and exit restoration; no browser errors. Rspack's served boot-app asset was verified to contain the new toolbar control and shared provider.

## Skinned avatar catalog, animation and environments upgrade

Browser-side suites now pass **33 tests**: prior adapter/gateway cases plus locomotion playback, held-key animation continuity, reduced-motion gait, sit/wave interactions, participant isolation, 16 avatar asset hashes/licenses/self-contained buffers, GLB clip presence, and 8 CC0 environment asset validations. Full app TypeScript and API TypeScript passed with 0 errors.

The browser fixture exercises 16 participants with distinct avatar presets and verifies all four room templates:
- **Gaming Lounge**: 269 draw calls, 125,757 triangles, 187 geometries, 154 textures, 31.3ms p95 frame
- **Meeting Room**: 251 draw calls, 118,143 triangles, 179 geometries, 154 textures, 31.1ms p95 frame
- **Cinema Room**: 288 draw calls, 119,322 triangles, 189 geometries, 154 textures, 21.8ms p95 frame
- **Social Rooftop**: 410 draw calls, 218,882 triangles, 196 geometries, 165 textures, 19.9ms p95 frame

All models perform bone-pose checks: idle/walk/run/sit/wave clip mapping, walking and running motion, walking under reduced-motion, frozen reduced idle, and independent cloned skeletons. Evidence: `docs/3d-rooms/previews/browser-results.json` and `docs/3d-rooms/previews/gaming-lounge.png`. All assets are served locally from self-contained GLBs under CC0-1.0 and Khronos/Three.js licenses. Existing preference persistence is migrated to version 2 supporting all 18 avatar IDs.

### 2026-11-14 — remote TV playback regression

Remote screen publications are now advertised before subscription. The selected TV
stream requests demand through the existing voice watch graph and screen-share
subscription manager; it does not create a second voice or audio playback path.
The TV prefers a remote screen and retains selection by publication ID. Exit
releases only watch/subscription demand acquired by the TV, preserving existing
ordinary-view watches and avoiding cleanup against a replacement voice session.

The video binding depends on the MediaStreamTrack, not the 10 Hz snapshot wrapper.
Avatar loading has independent Suspense boundaries so a new avatar cannot hide the
whole environment. Environment/light components are memoized across movement
snapshots, and the TV surface is separated from the bezel to avoid depth conflict.
These address observed lifecycle defects; the user's periodic whole-scene flashing
still needs confirmation in their two-client session.

Validation:

- Vitest: 8 files, 55 tests passed, including remote publication discovery and four
  TV watch ownership / cross-channel / replacement-session lifecycle cases.
- Windows Chrome 157, AMD Radeon integrated graphics: existing browser fixture
  passed movement, typing focus, four templates, source-track retention, three
  mount/unmount cycles and WebGL-loss fallback.
- New browser assertion: video play() count remains constant over 2.1 seconds of
  10 Hz snapshots while a synthetic screen track is playing.
- Browser fixture uses 16 simulated avatars and a synthetic screen track, not two
  authenticated users. Real friend-to-friend screen-share verification is pending.
- Existing Three.js Clock and PCFSoftShadowMap deprecation warnings remain.
- Full relay_app TypeScript check (`tsc --noEmit`, heap limit 3584 MB) passed.
- Scoped Biome check passed for the adapter, scene, TV, watch lifecycle and tests.
  RoomPanel still has existing translation-plugin JSX text findings outside this fix.
