# Relay LAN and HTTPS access

The local public URL overrides live in the generated `orvix-dev public URL` block in `config/env/local.env` (ignored by Git). Keep existing unrelated local settings.

For this workstation, the canonical URL is `http://192.168.1.30:18088`. The Windows TCP proxy continues forwarding to port 8088. Public asset, API, media, and discovery URLs must use the canonical origin; Gateway and LiveKit use the same authority with the WebSocket scheme. Internal service addresses stay internal.

The environment block can be generated inside the workspace with:

```sh
target/debug/relay-dev tunnel print-env --public-url http://192.168.1.30:18088
```

For an existing HTTPS tunnel, supply its HTTPS origin instead, replace the generated local block, and reload the Relay development session. The helper derives HTTPS/WSS URLs and preserves custom ports. The tunnel hostname must already be configured and reachable; generating environment variables does not create a tunnel.

Verify `/api/.well-known/orvix` and the HTML script URLs from the phone-facing origin. They must not point to localhost. Use a fresh browser profile or reload to avoid the previous document and instance configuration. HTTP LAN access is not a secure browser context; passkeys, microphone/camera and other secure-context features should be tested over HTTPS.

Regression coverage: `cargo test -p relay-dev --lib tunnel::tests` checks HTTP LAN, standard HTTPS, custom-port HTTPS and IPv6 WebSocket authorities.

Legacy stored localhost URLs for the bundled `/web/android-chrome-512x512.png` and `/web/favicon-32x32.png` images are resolved against the current static endpoint when the public branding response is produced. Stored configuration, custom remote icons and uploaded media references are unchanged.

Desktop browsers may also open `http://localhost:8088` directly. An HTTP LAN public origin no longer redirects localhost pages to the LAN IP. Development bundles use root-relative URLs so both origins load their own scripts, chunks and fonts; production asset/CDN configuration is unchanged. Existing HTTPS tunnel redirects remain supported.

Zen/Firefox expose microphone APIs on localhost, which is a trustworthy browser context. An HTTP LAN IP is not a secure browser context; use localhost on the server workstation, or a reachable HTTPS origin for remote browser voice. No browser security preferences need to be weakened.

The workstation LAN TCP forwarder is the existing Windows desktop `relay-lan-proxy.cjs` process. It must be running separately from Docker for port 18088 to forward to localhost:8088. The public URL environment block does not start this Windows process.

## Admin login after a LAN IP change

On 2026-11-14 Windows Wi-Fi was verified as `192.168.1.30`. The previous
`192.168.1.28` in `config/env/local.env` also affected the admin OAuth authorization
URL, callback URL and API application redirect allowlist. These must agree. Update
the generated local URL block together and reload the Relay development session;
do not change OAuth secrets or user permissions to solve an address mismatch.

Start admin login directly at `http://192.168.1.30:18088/admin/` and keep that origin
throughout the flow. The admin flow uses sessionStorage, which is scoped to the
origin; starting on localhost and returning to a LAN callback can lose its verifier.
Close any old authorization tab and start a fresh flow after changing addresses.
Verify the current Windows IP before reusing these workstation-specific examples.
