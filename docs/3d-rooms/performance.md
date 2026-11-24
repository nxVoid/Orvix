# Measured performance — 2026-11-11

## Test environment

Windows headless Chrome 157.0.8103.50; ANGLE AMD Radeon(TM) Graphics (0x1636), Direct3D11. Browser reports 16 logical cores and 16 GiB deviceMemory (browser-rounded value, not a hardware inventory). Viewport 1280x900, pixel ratio 1. WSL development environment has about 10 GiB RAM; compilers run sequentially. Fixture is a development bundle of the actual RoomScene module, not the whole logged-in desktop app.

## 16-avatar rendering sample

Sixteen scene participants, ordinary frustum culling means not all are visible simultaneously. Source model 6,748 bytes, 24 shared vertices with transformed nodes, three animation clips, four palette presets; no external texture assets. Default dpr capped at 1.5, low graphics uses 1. No expensive shadows/postprocessing/physics solver.

Latest browser evidence is `previews/browser-results.json` (refresh from Windows temp after the final run): initial p95 frame interval 8.3 ms. Gaming/meeting/cinema samples were approximately 9.5–10.8 ms p95 in that run, about 70–85 visible draw calls, 1,026–1,258 visible triangles, 18–20 geometries and 11 name textures. One synthetic subscribed screen added one texture and one geometry (12/21). These are RAF intervals and Three resource counters, **not GPU timer-query times or guaranteed production FPS**.

Three repeated exit/re-entry cycles yielded exactly zero/one canvas, while the existing synthetic video source track stayed live. JS heap at the final sample was about 22.2 MB; this single sample is not a leak proof. No uncaught browser exception was recorded; R3F/Three emitted the dependency deprecation warning `THREE.Clock ... use THREE.Timer` on Canvas creation. No vendored dependency was patched to suppress it.

## Server simulation and bandwidth

16 participants x 100 updates = 1,600 validated commands, with normalized input, deterministic clock and serialized in-memory lock/mock cache. Latest recorded simulation: about 170 ms total CPU/wall processing and 3,978,402 serialized response bytes. This is a fast local policy simulation, **not an HTTP, NATS, Valkey or WAN latency benchmark**. At ten complete responses/user/second that payload corresponds to roughly 0.398 MB/s aggregate HTTP response payload for the room, excluding headers/TLS and additional gateway snapshots. Coalesced gateway fanout adds at most about the same payload order at 10 room snapshots/second; join/leave can add immediate events. Compression has not been assumed.

A separate test uses real PostgreSQL advisory locks and two service instances against an isolated namespace: 20 concurrent admissions produce exactly 16 successes and four full-room failures. It does not substitute for a real Valkey/NATS load benchmark.

## Still required

A 16-machine/network-user soak, API+real-cache throughput, end-to-end input latency, CPU utilization, GPU timer queries/VRAM, native packaged desktop and actual voice/audio interruption measurements. No unmeasured target is marked achieved. Feature stays disabled by default until those release gates pass.

## 16-Avatar catalog and 4 environments sample (Current)

Measured with 16 distinct skinned avatars and 4 rich environments:
- **Gaming Lounge**: 269 draw calls, 125,757 triangles, 187 geometries, 154 textures, 31.3 ms p95 frame
- **Meeting Room**: 251 draw calls, 118,143 triangles, 179 geometries, 154 textures, 31.1 ms p95 frame
- **Cinema Room**: 288 draw calls, 119,322 triangles, 189 geometries, 154 textures, 21.8 ms p95 frame
- **Social Rooftop**: 410 draw calls, 218,882 triangles, 196 geometries, 165 textures, 19.9 ms p95 frame
- **Screen Share (16:9 texture projection)**: 405 draw calls, 214,380 triangles, 168 textures, 39.4 ms p95 frame
- **Memory**: JSHeapUsedSize ~44.3 MB for full 16-avatar scene with rich furniture models and skyline.
- **Resource Cleanup**: 3 repeated exit/re-entry cycles verified: canvas count toggles cleanly 0 -> 1, live media stream video tracks retained without leaking.
- **Graphics presets**: Standard (dpr 1.5, soft shadows), High (dpr 2.0, soft shadows), Low (dpr 1.0, shadowless). Evidence is recorded in `docs/3d-rooms/previews/browser-results.json` and `docs/3d-rooms/previews/gaming-lounge.png`.
