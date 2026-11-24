# Relay mobile login connection diagnosis (2026-11-10)

## Confirmed cause

The phone timed out in both Chrome and the Flutter app. Windows Wi-Fi is
`192.168.1.28/24`, with the **Private** firewall profile. The Windows Node LAN bridge
returned discovery HTTP 200 from the host, but existing Node firewall allowances
applied only to **Public** networks. After the user applied the scoped Relay LAN
firewall rules, the phone opened Relay successfully. This confirms an inbound
Windows firewall problem, rather than an invalid password or an HTTP error.

Independent mobile defects made this harder to recover from:

- `InstanceConstants` hardcoded `http://192.168.1.28:18088` as the default.
- The configured default bypassed discovery, and initial login was permitted
  without confirming server availability.
- A connection timeout was passed through `AuthRepository` as Dio's raw message.
- Unauthenticated server selection was not restored independently of an account.

The 15-second connect timeout is unchanged.

## Connection path

```text
Android (same LAN)
  -> Windows Wi-Fi IPv4:18088 (Private firewall, LocalSubnet only)
  -> Windows Node Relay LAN bridge
  -> Windows 127.0.0.1:8088
  -> Docker published 127.0.0.1:8088
  -> Relay development reverse proxy
  -> /api, /gateway, /media, /livekit
```

Docker ports stay loopback-bound. No Docker services, volumes, database records,
other projects, global firewall settings, or network profiles were changed for
this login fix. Android `localhost` refers to Android itself.

At diagnosis, both host discovery requests returned HTTP 200:

- `http://localhost:8088/api/.well-known/orvix`
- `http://192.168.1.28:18088/api/.well-known/orvix`

The document advertised API `/api`, Gateway
`ws://192.168.1.28:18088/gateway`, and media `/media` on the LAN origin. The mobile
SDK appends `/auth/login` to the discovered API base. Discovery errors distinguish
HTTP redirects/invalid documents, HTTP 5xx, connection timeouts, and unreachable
hosts. DNS/refused connections are transport failures, not authentication failures.

## Mobile behavior

The login server selector runs fresh discovery before enabling authentication.
Selecting a saved server also runs discovery. Blank, malformed, credential-bearing,
query-bearing, fragment-bearing URLs and invalid ports are rejected. Bare hosts
use HTTPS; an explicit `http://` is required for a debug LAN server.

A clean install has no forced server. An internal `https://relay.invalid/api`
placeholder only keeps SDK construction valid; discovery rejects it and startup
does not fetch it. An optional `RELAY_SERVER_URL` compile-time default is still
supported, but never bypasses discovery.

Only the selected URL is stored in SharedPreferences under
`relay.selected_instance_url`; no passwords or tokens are added there. Existing
account snapshots and secure token storage remain intact. On reopening the app,
the saved URL is shown and must pass a connection test before login. A failed or
superseded discovery cannot replace the active instance. Existing issuer checks
prevent a previous instance's session token being sent to another instance.

Discovery supplies the API/Gateway/media endpoints; unrelated API/Gateway hosts
are rejected. Changing the active snapshot rebuilds clients, closes the old Dio
client and invalidates the existing reactive Gateway/discovery dependencies.

Timeout, unreachable server, invalid server address, temporary HTTP failure, and
invalid credentials have separate user-facing errors. Turkish localization is
provided, with retry and server-change actions. Debug HTTP logging records only
method, origin/path, status and exception type, never headers, query parameters,
bodies, raw exceptions, passwords, or tokens.

Debug permits local HTTP. Release requires HTTPS in both the API transport policy
and the Android network security resource. Native Android requests retain the
INTERNET permission in all variants. HTTP redirects are not followed by discovery
or the authenticated API client.

## LAN firewall setup and rollback

First confirm the current Wi-Fi IP, the discovery response, and that the Relay
bridge is listening. IP changes require updating Relay's public API/Gateway/media
configuration too; never substitute another server or silently rewrite an account
issuer. Review `tools/relay/enable-lan-firewall.ps1` before applying it.

Run in **Administrator PowerShell** from this repository:

```powershell
.\tools\relay\enable-lan-firewall.ps1
```

The script refuses non-Private interfaces, reads the active interface IPv4,
resolves `node.exe`, and creates only these named rules:

- `Relay-Dev-LAN-TCP`: Node, current Wi-Fi IP, TCP 18088 and 7881.
- `Relay-Dev-LAN-UDP`: Node, current Wi-Fi IP, UDP 7882.

Both are limited to Private/LocalSubnet. Rollback:

```powershell
.\tools\relay\enable-lan-firewall.ps1 -Undo
```

A copy was delivered on Windows Desktop as `Relay-LAN-Firewall.ps1`. The user
applied it and confirmed the phone could open Relay. If discovery stops working,
check the actual active IP, bridge process, Private profile, and whether the phone
is on a guest network/VPN/mobile data with no route to the PC.

Start the existing bridge manually on **Windows**, using the verified current IP:

```powershell
node .\tools\relay\lan-bridge.cjs --host <current-Wi-Fi-IPv4>
```

It must not already be running on those ports. Stop only that bridge process to
undo it. The CLI no longer assumes a default LAN IP. This bridge is for the LAN;
remote users need a reachable HTTPS deployment/tunnel with matching discovery
and a separate reachable WebRTC media path.

## APK and validation

The requested debug build uses `canaryUnifiedpush` / ARM64, with package ID
`com.relay.mobile.canary`. It installs beside the stable `com.relay.mobile` release,
so installing it does not require deleting the stable app or its data. Select
`http://192.168.1.28:18088` explicitly for this LAN test. Production builds must
select an actual HTTPS instance.

Targeted tests cover normalization, discovery responses and network failures,
HTTPS policy, secret-free logs, selection persistence, superseded discoveries,
API token issuer boundaries, login error mapping, and Gateway URL port/path.
A real phone is not attached to ADB here. After applying the firewall rule, the
user confirmed successful login and a working chat screen in the installed Android
app. Host HTTP 200, unauthenticated API 401, and Gateway HELLO were also verified.
The newly built debug APK is a separate artifact and has not been installed on a
physical device by this agent.

Additional host verification returned discovery 200, unauthenticated `/users/@me`
401 (expected), and a Gateway WebSocket HELLO with opcode 10. Both Relay firewall
rules were read back as enabled Allow/Private/LocalSubnet on `192.168.1.28`.

Legacy account migration now retains Fluxer accounts on their canonical Fluxer
issuer; changing Relay's build default cannot migrate an account to the selected
Relay host or the unconfigured placeholder.

References for the OS behavior and debug/release Android resource split:

- https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule
- https://docs.flutter.dev/release/breaking-changes/network-policy-ios-android

## Changed files for this task

Mobile connection and selection:

- `relay_mobile/lib/core/instance/instance_constants.dart`
- `relay_mobile/lib/core/instance/instance_endpoint_normalizer.dart`
- `relay_mobile/lib/core/instance/instance_discovery_service.dart`
- `relay_mobile/lib/core/instance/instance_compatibility_messages.dart`
- `relay_mobile/lib/core/instance/instance_legacy_endpoint_migrator.dart`
- `relay_mobile/lib/core/providers/instance/active_instance_provider.dart`
- `relay_mobile/lib/core/providers/instance/well_known_provider.dart`
- `relay_mobile/lib/features/auth/providers/instance_selector_provider.dart`

API safety and authentication errors:

- `relay_mobile/lib/core/api/fluxer_client_provider.dart`
- `relay_mobile/lib/core/api/instance_transport_interceptor.dart` (new)
- `relay_mobile/lib/core/api/safe_http_log_interceptor.dart` (new)
- `relay_mobile/lib/features/auth/data/auth_repository.dart`
- `relay_mobile/lib/features/auth/domain/auth_failure.dart`
- `relay_mobile/lib/features/auth/domain/login_error.dart`
- `relay_mobile/lib/features/auth/providers/login_error_l10n.dart`
- `relay_mobile/lib/features/auth/providers/login_view_model.dart`

UI, localization and Android policy:

- `relay_mobile/lib/features/auth/presentation/widgets/login_form.dart`
- `relay_mobile/lib/features/auth/presentation/widgets/instance_selector.dart`
- `relay_mobile/lib/l10n/fluxer_en.arb`, `fluxer_tr.arb`, generated localizations
- `relay_mobile/android/app/src/main/res/xml/network_security_config.xml`
- `relay_mobile/android/app/src/debug/res/xml/network_security_config.xml` (new)

LAN support:

- `tools/relay/enable-lan-firewall.ps1` (new; admin-run, reversible)
- `tools/relay/lan-bridge.cjs` (requires explicit `--host`)
- This report, `docs/relay-mobile-login-connection.md`

New regression tests:

- `relay_mobile/test/core/api/instance_transport_interceptor_test.dart`
- `relay_mobile/test/core/api/safe_http_log_interceptor_test.dart`
- `relay_mobile/test/core/providers/instance_selection_connection_test.dart`
- `relay_mobile/test/features/auth/data/login_connection_failure_test.dart`

Updated regression tests:

- `relay_mobile/test/core/instance/instance_discovery_service_test.dart`
- `relay_mobile/test/core/instance/instance_endpoint_normalizer_test.dart`
- `relay_mobile/test/core/instance/instance_legacy_endpoint_migrator_test.dart`
- `relay_mobile/test/features/auth/utils/instance_discovery_error_l10n_test.dart`
- `relay_mobile/test/features/auth/presentation/widgets/instance_selector_test.dart`

When the selected authentication instance changes, the login form clears typed
credentials and authentication challenges. A login response arriving after a
server change is rejected before token persistence. Successful login activation
also checks the expected API issuer and explicitly binds the in-memory token to
that issuer.

Final source analysis: targeted `flutter analyze --no-pub` across the modified API
clients, instance layer, active/discovery providers and authentication feature
completed with **No issues found** (122.7 seconds). The initial whole-project scan
was stopped because it competed with the Android build for WSL memory; checks
were then run sequentially and scoped to the changed feature.

Final Flutter regression suite: **145 tests passed** across 16 targeted files,
including successful credential login/session persistence, wrong credentials,
timeouts (including Dio's transform timeout), old/unreachable server, a login
response arriving after a server switch, selection persistence, issuer-bound
API calls, Gateway URL refresh, and login/selector widget regressions. The Relay
LAN bridge integration suite also passed all **3 tests**. PowerShell syntax and
scoped whitespace checks passed.

Two existing auth test files were also adjusted: `auth_repository_test.dart`
expects legacy Fluxer accounts to retain their Fluxer issuer, and
`login_view_model_test.dart` supplies an explicit instance for isolated auth mocks.

Debug APK command (from `relay_mobile`, with Flutter/Java/Android SDK configured):

```sh
flutter build apk --debug --flavor canaryUnifiedpush --no-pub \
  --target-platform android-arm64 \
  --build-name 2026.11.10.3 --build-number 2026111003 \
  --dart-define=APP_ENVIRONMENT=canary \
  --dart-define=PUSH_PROVIDER=unifiedpush \
  --dart-define=OBSERVABILITY_REPORTING=false
```

## Delivered APK

- Windows: `C:\Users\ufukw\Desktop\Relay-Mobile-2026.11.10.3-arm64-debug.apk`
- WSL: `/mnt/c/Users/ufukw/Desktop/Relay-Mobile-2026.11.10.3-arm64-debug.apk`
- Project output: `relay_mobile/build/app/outputs/flutter-apk/app-canaryunifiedpush-debug.apk`
- Size: 291,882,327 bytes.
- SHA-256: `2dff736fc4511d038ada0a5e46f06728d2cf707b379fa8a54af21882ca58c13e`.
- Package: `com.relay.mobile.canary` / Relay Canary.
- Version: `2026.11.10.3-canary` / `2026111003`.
- Flutter engine target: ARM64 (`arm64-v8a`); this is not a universal Flutter build.
- APK v2 signature verified, Android INTERNET permission present.
- Packaged debug network security XML permits cleartext; system/bundled trust anchors preserved.
- Build completed successfully in 751.5 seconds.

Validation logs are retained under `.relay/reports/mobile-login-20261110/`.
The new APK was verified as a file; authenticated phone login/chat were verified
by the user using the previously installed app after the firewall correction.
No real-device installation of this new debug APK was performed.
