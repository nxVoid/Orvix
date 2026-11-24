# Relay Pinggy testing — current local session

## 2026-11-14 session (local time)

Current web URL: https://asiwm-176-88-77-180.free.pinggy.net

Alias: https://miblw-176-88-77-180.run.pinggy-free.link

Relay's local web/proxy port is 8088; port 80 is not listening. The requested SSH tunnel therefore targets 127.0.0.1:8088. Detached SSH sessions are tracked under the ignored `.relay/runtime/pinggy-session/` directory so they do not depend on an interactive tool terminal. No password/token is stored in this document. Pinggy advertised a 60-minute lifetime for these sessions; URLs expire and must be recreated afterward.

The workstation Wi-Fi IPv4 was verified as **192.168.1.30**, replacing the previous .28. Public media uses a separate TCP tunnel `iotjp-176-88-77-180.run.pinggy-free.link:37427` (172.104.241.168), through WSL loopback 17891 and the existing main LiveKit mapping 17881. Only `orvix-dev-livekit-1` was recreated to advertise the public node IP and matching TCP port. Base Compose/YAML defaults were not changed. The scoped watchdog restores the verified LAN IP/7881 when this exact media SSH session ends.

Current scoped rollback:

```sh
python3 tools/relay/pinggy-voice-watchdog.py --lan-ip 192.168.1.30 --stop
```

The running Relay Music container mounts **Windows Desktop/relay-bot/config.json** and storage. Its existing local Docker routes `http://workspace:8088` and `ws://livekit:7880` are intentionally retained: the bot is on the same computer and need not route its own API/signaling over the temporary public tunnel. API authentication returned 200 for the expected bot account, bot logs confirmed login and NodeLink connection, and the container health check was healthy. The bot container's own LiveKit SDK connected and published test audio in an isolated diagnostic room; it did not send chat commands or play audio to user channels. The user subsequently confirmed that `!play` made the bot join the voice channel and play music through the public testing session.

Clean Windows Chrome loaded the public login screen. Discovery at `/api/.well-known/orvix` and `/api/ip` returned JSON/200. The root `/.well-known/orvix` returns the SPA fallback, so clients use their existing API-routed discovery fallback/adoption. Public WSS gateway returned HELLO opcode 10. Unauthenticated LiveKit validation returned expected 401. The user confirmed voice connected after the media profile was applied. SDK diagnostic evidence, where available, is recorded separately under `.relay/reports/pinggy-20261114/`.

No Nexora changes, user-data resets, global Docker cleanup or paid-service activation. An isolated diagnostic LiveKit container was created and removed before using the main media path. Temporary short-lived grants are removed after the checks. Existing application source and bot credentials are preserved.

---

## Historical 2026-11-11 session

## Historical links and verified result

Primary web link: https://bsobu-176-88-77-180.run.pinggy-free.link

Alias: https://puewd-176-88-77-180.free.pinggy.net

Keep the existing HTTP SSH terminal open. Pinggy Free sessions expire after
60 minutes and restarting them changes their addresses. These are temporary
session URLs, not permanent deployment addresses.

The user confirmed login, working chat, and joining voice through the Pinggy page.
Clean Firefox/Zen and Chrome profiles also loaded the login screen. Chrome
confirmed `/api/ip` returned JSON after its screening-header fix. From Firefox:

- Cookie-free discovery with the documented header: HTTP 200 JSON.
- Unauthenticated API request: expected HTTP 401.
- Gateway WSS: HELLO opcode 10.

## Root causes and source changes

Pinggy's screening page intercepted browser requests made with `credentials: omit`.
Those discovery requests received HTML instead of JSON even after the top-level
page's "Enter site" confirmation. The fix adds `X-Pinggy-No-Screen: 1` for HTTPS
requests on Pinggy's actual free tunnel hostname suffixes. Credentials and cookie
policy remain intact; other hosts and deceptive suffixes receive no new header.

Changed web request sites:

- `packages/instance_bootstrap/src/Discovery.ts`
- `relay_app/src/features/platform/transport/RestTransport.ts`
- `relay_app/src/features/app/state/GeoIP.ts`

Shared helper and regression coverage:

- `packages/instance_bootstrap/src/PublicTunnelHeaders.ts`
- `packages/instance_bootstrap/src/PublicTunnelHeaders.test.mjs`

Voice initially tried the backend's LAN signaling URL,
`ws://192.168.1.28:18088/livekit`, from the HTTPS Pinggy page. The connection
adapter now resolves the instance's conventional `/livekit` proxy through the
active API transport. It preserves a separately hosted voice server, custom
paths, and desktop local protocol transport. Both initial connection and region
hot-swap use the helper:

- `packages/instance_bootstrap/src/VoiceSignalingEndpoint.ts`
- `packages/instance_bootstrap/src/VoiceSignalingEndpoint.test.mjs`
- `relay_app/src/features/voice/engine/v2/VoiceEngineV2AppConnectionHostAdapter.ts`

## Public WebRTC media path

An HTTP tunnel does not forward the LAN ICE/UDP address. A separate temporary
Pinggy **TCP** tunnel was opened for LiveKit's ICE/TCP traffic. The public path is:

```text
Browser WebRTC TCP
  -> ftriz-176-88-77-180.run.pinggy-free.link:39181 (213.109.192.63)
  -> managed SSH TCP tunnel
  -> WSL loopback :17891 (scoped byte-preserving bridge)
  -> loopback :17881 (existing Docker upstream mapping)
  -> LiveKit TCP :39181
```

Before changing the main service, an isolated LiveKit container was used for an
actual SDK audio publication test. It connected in 1,526 ms, published one fake
microphone track, and selected remote TCP 213.109.192.63:39181 with 8,829 bytes sent.
The isolated test container and short-lived diagnostic grant files were removed.
The main LiveKit was then recreated with only its advertised IP/TCP port changed.
Its log confirmed the real user's participant became active on the public TCP
candidate, and the user confirmed that voice connected.

The main profile is applied through `.relay/runtime/pinggy-voice.env`; defaults
in `.devcontainer/docker-compose.yml` and `.devcontainer/livekit.yaml` were kept.
Only the LiveKit service was recreated, with `--no-deps --no-build`.

## Automatic fallback and manual rollback

`tools/relay/pinggy-voice-watchdog.py` monitors the exact managed SSH process.
When it ends, the watchdog restores the verified LAN advertisement
`192.168.1.28`, TCP 7881. It checks both the current container's public node IP and
TCP port first, and refuses to overwrite a profile changed separately or a newer
tunnel session. Cleanup of the scoped bridge is protected by process identity.

The running process/log/endpoint files are under `.relay/runtime/pinggy-voice-*`.
The watcher is armed for this active session. To stop the managed media tunnel and
restore LAN immediately, run from WSL in this repository:

```sh
python3 tools/relay/pinggy-voice-watchdog.py --lan-ip 192.168.1.28 --stop
```

This deliberately ends public voice connectivity. It leaves the user's separate
HTTP SSH terminal under their control. When creating a future TCP tunnel, its
public IP/port and managed session metadata must be updated before reapplying the
public media profile. It is not an automatic tunnel-renewal service.

## Checks

- 29 Node tests passed: network origin normalization, Pinggy screening headers,
  conventional voice route translation, external voice preservation.
- 2 Python watchdog tests passed: exact profile ownership and missing-process handling.
- `tsc --noEmit -p packages/instance_bootstrap/tsconfig.json` passed.
- Biome checked all 8 changed TS/JS files. Root-rule checks ran on exact file
  copies in a temporary isolated root because the existing vendored
  `relay_mobile/fluxer/biome.json` otherwise causes a nested-root configuration error.
- Scoped `git diff --check` passed.
- No release/mobile/desktop build was run for these web changes; the development
  web server rebuilt its affected modules.

Verification metadata and test logs: `.relay/reports/pinggy-20261111/`.

## Service documentation

- Screening and the supported header: https://pinggy.io/docs/http_tunnels/screening/
- TCP tunnels: https://pinggy.io/docs/tcp_tunnels/
- Free session lifetime: https://pinggy.io/
- LiveKit ICE/TCP behavior: https://docs.livekit.io/transport/self-hosting/ports-firewall/
