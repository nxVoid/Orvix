# Relay desktop downloads

## Repository discovery

The official rendered Fluxer download website is **not included in this checkout**. The original Git tree has download documentation and marketing logo assets, but no marketing download page. The source repository of that external website is not identified here; it would be speculation to name one.

These are the relevant checked-in sources, now under their Relay paths:

| Source | What it contains |
| --- | --- |
| `relay_docs/src/content/docs/downloads/overview.md` | Package-host documentation and directory overview |
| `relay_docs/src/content/docs/downloads/desktop.md` | Desktop coordinates, formats, `latest` response and updater contracts; **not** the marketing download page |
| `relay_docs/src/content/docs/downloads/linux-repositories.md` | apt, dnf, pacman and Flatpak instructions |
| `relay_app/src/features/app/config/I18nDisplayConstants.ts` | Previously sent app download buttons to the external Stable/Canary Fluxer download websites; now resolves this instance’s `/download` when clicked |
| `relay_desktop/src/common/Constants.ts` | Inherited desktop web/download origins and development URLs |
| `relay_api/src/api/download/DownloadController.ts` | `/dl/desktop/:channel/:plat/:arch/...` GET/HEAD redirects |
| `relay_api/src/api/download/DownloadRedirects.ts` | Upstream package-host redirect mapping, including `latest` to `latest.json`; not a rendered page or package-host implementation |
| `tools/ci/src/desktop.rs` | Platform packaging, staged payloads, coordinate manifests, checksums and updater feeds |
| `tools/ci/src/release.rs` | GitHub release validation, draft creation, asset upload and publication |
| `.github/workflows/build-desktop.yaml` | Stable/Canary build matrices, artifact handoff and explicit release publishing jobs |
| `relay_desktop/electron-builder.config.cjs` | Electron identity, icons, OS packaging settings and signing/notarization |
| `relay_desktop/src/main/ShellDownloadFormats.ts` | Native updater’s package-origin override and coordinate URLs |
| `tools/dev/src/desktop_modules.rs` | Local development module-package host at port 48780; not a marketing site or a published desktop installer feed |

The original Git paths include `fluxer_docs/src/content/docs/downloads/{desktop,overview,linux-repositories}.md` and `fluxer_static/marketing/branding/`; these do not contain the official download website. Current sources still reference `https://fluxer.com/download`, `https://canary.fluxer.com/download` and `https://pkgs.fluxer.com` in inherited native/release infrastructure. Those domains identify the upstream deployment and are not proof that its marketing source is present.

## Implemented page

`/download` is a public, lazily loaded route in the existing React/Rspack app, outside the authenticated app layout. It is exempt from automatic signed-in redirects and the self-hosted setup/gateway gate. The page reuses the Relay logo, the existing Relay favicon/document shell and the app’s font assets. It has responsive desktop/mobile layouts, OS detection, explicit architecture selection, Stable/Canary selection, real metadata-derived version/date/size/notes, loading/retry/unavailable states, and a browser fallback.

All existing app-side download entry points (sidebar, nagbars, voice settings, screen sharing and updater dialogs) use `getDesktopDownloadUrl()`, which resolves `/download` against the active instance’s public web endpoint at click time. This also works from Electron’s local renderer origin; it does not evaluate a `null` custom-scheme origin during module initialization.

The production build also exposed and fixed a leftover Rspack workspace alias: `@orvix` became `@relay`. TypeScript already used Relay paths, but that bundler alias had prevented font and internal-package resolution.

## Release configuration

The page fetches **`/assets/relay-downloads.json`**, emitted by the existing Rspack asset copier from:

```
relay_app/assets/assets/relay-downloads.json
```

The deliberate initial configuration is:

```json
{
  "schema_version": 1,
  "package_origin": null,
  "releases": []
}
```

This publishes **no invented builds or download URLs**. Until Relay artifacts are configured, the page shows unavailable states and offers the browser app. It never silently substitutes upstream Fluxer binaries.

### Use the existing package-host contract

Set `package_origin` to the actual base URL of your Relay package service. Leave `releases` as an empty array unless you also want manually listed fallback releases. For each selected Stable/Canary channel, the page reads:

```
{package_origin}/desktop/{channel}/{win32|darwin|linux}/{x64|arm64}/latest
```

The documented response has `version`, optional `pub_date`, and `files` entries with a `url` and optional `sha256`. Optional `size` or `bytes`, `release_notes_url`, and `minimum_system_version` are displayed when supplied. Failed `latest` requests fall back to the existing CI coordinate **`manifest.json`**. That manifest accepts filename strings or `{filename, sha256}` entries; filenames resolve only within the coordinate directory. Missing formats do not become guessed `/latest/{format}` links.

Only two requests run concurrently. Switching channels cancels pending work; each load has a 20-second overall deadline. Metadata fetches omit credentials and use `cache: no-store`. Missing coordinates are independent and cannot prevent confirmed downloads for another platform from appearing. Errors have a retry action.

Serve the configuration file and mutable release metadata with `Cache-Control: no-store` at your CDN/reverse proxy. The existing asset proxy otherwise gives unhashed assets a one-hour revalidation policy. An external metadata host must allow the web app’s origin through CORS, and the app proxy’s existing `ORVIX_CSP_EXTRA_CONNECT_SRC` deployment setting must permit that host. No browser-side secret or GitHub token belongs in this public file.

### Use actual GitHub release assets or a CDN directly

`package_origin` may stay `null`. Put verified published releases in the `releases` array with these fields:

| Field | Value |
| --- | --- |
| `channel` | `stable` or `canary` |
| `platform` | `win32`, `darwin` or `linux` |
| `arch` | `x64` or `arm64` |
| `version` | Actual published release version |
| `pub_date` | Optional ISO timestamp |
| `release_notes_url` | Optional actual release page URL |
| `minimum_system_version` | Optional OS requirement |
| `files` | Map from a supported format to `{url, size?, sha256?}` using actual `browser_download_url` values or your CDN URLs |

Do not list formats or architectures absent from the release. GitHub’s release asset `size` can be copied into each file entry. A CI manifest can also be listed directly, using its real filenames and an appropriate serving base; for external manual entries use absolute artifact URLs. Tests use reserved `.example.invalid` URLs and a synthetic version, exclusively in test memory; these are not shipped release records.

Updating the checked-in configuration requires rebuilding the app. A deployment may instead serve a current configuration at the same public URL without rebuilding the frontend. No release polling requires a private token.

## Existing packaging and distribution

- **Windows:** Electron Builder assembles the application directory. The Rust CI helper then runs pinned Velopack `vpk pack` with the real Relay executable, channel-specific preserved installer IDs, icons, runtime metadata and Azure Trusted Signing. CI validates/stages `.exe`, portable `.zip`, `.nupkg`, `RELEASES`, `releases.win.json` and related assets. Publishing is a separate workflow step.
- **Linux:** Electron Builder and the CI helpers produce the supported AppImage, DEB, RPM and tar.gz files. The AppImage updater emits a `.zsync` feed. Repository-managed installations update through their package manager. The page only enables formats present in the selected coordinate’s metadata.
- **macOS:** Electron Builder produces the configured universal application/DMG/ZIP, with entitlements, signing and notarization controlled by the existing release settings. Universal outputs are represented at both `darwin/x64` and `darwin/arm64` coordinates by `published_arches`; the page exposes Intel and Apple Silicon choices only when that metadata actually exists.
- **Artifact upload:** the current workflow stages outputs in `upload_staging`, passes them through GitHub Actions artifacts, assembles `release_assets`, then uses the Rust release publisher to upload and publish GitHub Releases. Its existing repository/credential configuration remains deployment-owned; no replacement organization or release repository was invented. The public package-host delivery layer is documented and referenced here, but its production service implementation is not present as a website in this checkout.
- **Auto-updates already exist:** Velopack/Squirrel-compatible Windows feeds, macOS `RELEASES.json`/`releases.json`, Linux AppImage feeds, and signed/hash-addressed desktop module manifests. `RELAY_DESKTOP_PACKAGE_ORIGIN` configures the native client’s package host, with the legacy setting retained as a compatibility fallback. The new web page uses that same release-coordinate contract; it does not change installed IDs, profile storage, or updater signatures.
- **Channels:** publishing workflows expose Stable and Canary. Development uses local app/module origins (`localhost:8088`, package modules at `localhost:48780`) and is not represented as an invented public download channel.

Before distributing Relay, configure owned public URLs, release repository credentials and signed feeds. Inherited native fallback URLs still point at the upstream deployment until deployment configuration is completed, as documented in `branding/RELAY.md`. This task did not publish releases, upload binaries, alter update feeds, or modify existing release artifacts.

## Local development

Use the existing devcontainer and infrastructure. From the project root:

```sh
pnpm install --frozen-lockfile
pnpm i18n:compile
CARGO_BUILD_JOBS=1 pnpm dev
```

Open **http://localhost:8088/download**. If the existing development process was started before the directory migration, restart that development process against the current source so it loads the corrected aliases; do not recreate its volumes or databases. No separate website framework or new dependencies are required.

For a normal frontend production build, use the project’s existing build workflow. During this task the build was run programmatically with a fresh `/tmp/relay-download-build-*` output, disabled output cleaning, and the asset-copy destination redirected to that same directory. Existing `dist` outputs and prior backups were preserved.

## Modified files and verification

The exact change list, snapshot location, test results and browser evidence are recorded in the accompanying `RELAY-DOWNLOADS-RESULTS.md` after final validation.
