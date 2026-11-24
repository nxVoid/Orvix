# Relay migration report

The existing rebrand was continued in place. All 18 first-party service directories now use `relay_*`: admin, API, app, app proxy, common, desktop, docs, gateway, GIFs, media proxy, messages, push, rexctl, snowflakes, static, svc, unfurl and users.

JavaScript workspace packages and imports use `@relay/*`. Rust service/tool/native crate names, Erlang gateway application/modules, TypeScript symbols and paths, 282 private native symbols, 56 private C macros, Cargo and pnpm manifests/lockfiles, Docker build references, CI/release scripts, and the Helm source directory were updated together. First-party logo and font source paths now refer to Relay. Existing upstream codec/library names were retained where they identify the underlying library.

The desktop application, splash artwork, Windows executable/installer titles, Linux desktop display names, package descriptions and generated icons use Relay. Relay deep links work alongside legacy Orvix links. Portable controls and update-origin settings accept Relay names, while existing profile directories and legacy Chromium flag files remain readable.

A new pre-edit source snapshot and rename manifest were created under `.orvix/relay-rebrand/technical-20261108T220547064053Z/`. Earlier rebrand logs, snapshots, database dumps and historical migration content remain available. Historical source files inadvertently traversed during the initial automated pass were restored and compared byte-for-byte against the new pre-edit snapshot; the preservation audit reports no errors. No database, upload, Docker volume or Nexora resource was modified. No commit or push was made.

## Compatibility and release requirements

See [RELAY.md](RELAY.md) for the complete compatibility policy and local run instructions. Intentional legacy names include persisted storage keys and profile paths, database/bucket names, protobuf namespaces, wire headers/error values, installed bundle/package/update module IDs, signing identities, Docker volume/project names, the existing Helm resource naming default, `ORVIX_*` deployment settings, upstream attribution, and historical fixtures/tools.

Docker image names now use Relay. Build and publish those images in your configured registry before deploying the changed Compose or Helm configuration; this migration did not deploy or pull replacement images. Existing registry-owner defaults and public service URLs remain deployment configuration.

Production release feeds and public URLs still need to be configured for the Relay deployment. Set `RELAY_DESKTOP_PACKAGE_ORIGIN` to the owned signed release feed before distribution; the inherited production feed can return upstream software. Native desktop modules must be rebuilt after source/package changes. Windows/macOS installation, signing, and real installed-client upgrade behavior require validation on those platforms.

## Validation

Checks ran sequentially with one Cargo build job and one API test worker. Full checks use bounded execution times. Exact commands/results and logs are kept in the timestamped recovery directory. The final results are below.

| Final check | Result | Exit code |
| --- | --- | --- |
| Source imports, CSS assets and Cargo paths | 32,052 imports and 45 Cargo manifests; no unresolved references | 0 |
| API TypeScript | Passed | 0 |
| App TypeScript | Passed | 0 |
| Desktop TypeScript | Passed | 0 |
| API branding/configuration/codec/session tests | 78 passed | 0 |
| API billing branding regression tests | 29 passed | 0 |
| Rust app-proxy branding tests | 2 passed | 0 |
| Rust CI, desktop packaging and release tests | 122 passed | 0 |
| Desktop artwork and preserved identity checks | 10 passed | 0 |
| Desktop deep-link and update-setting behavior | 2 passed | 0 |
| Full Rust workspace, existing devcontainer | Passed, including final native-symbol/macro changes | 0 |
| Erlang gateway compile and both native hooks | Passed in existing devcontainer | 0 |
| Frozen pnpm lockfile | 40 projects; 2,059 policy entries verified | 0 |
| Biome formatting verification | 3,228 changed files, plus final edited defaults | 0 |
| Rust formatting | Passed | 0 |
| Git whitespace verification | Passed | 0 |
| Preservation audit | 3,593 source/license checks, 3,584 historical file comparisons; 15,772 historical paths present | 0 |

The first host-wide Rust check exited **101** because the host lacks `vips.pc`; the existing devcontainer supplied the required native dependencies and the full workspace check subsequently passed there. Earlier failed iterations and their logs remain available for audit. The sandboxed pnpm check could not open its existing cache database; the approved retry passed against the unchanged frozen lockfile.

Final logs and the machine-readable result index are in [the technical recovery directory](../.orvix/relay-rebrand/technical-20261108T220547064053Z/). Important files include `final-results.json`, `last-checks/validation.json`, `complete/api-tests.log`, `complete/rust-packaging.log`, `container-rust-verified.log`, `gateway-compile.log`, `lockfile-verified.log`, `post-checks/format-verify.log`, `preservation-audit.json`, and `historical-path-audit.json`.

Windows/macOS signed installer execution and full platform-specific native desktop builds were not run on this Linux environment. They remain release validation requirements, rather than passing checks inferred from the source tests.

## Run Relay locally

Use the existing devcontainer and configuration; do not recreate or delete its volumes. From the project root:

```sh
pnpm install --frozen-lockfile
pnpm i18n:compile
CARGO_BUILD_JOBS=1 pnpm dev
```

Open **http://localhost:8088**; the admin panel is at **http://localhost:8088/admin**. For desktop development, run `pnpm dev:desktop:deps` to rebuild native modules, then use `pnpm dev:desktop:app` and `pnpm dev:desktop:run`. See [the identity and compatibility policy](RELAY.md) before distributing a production build.
