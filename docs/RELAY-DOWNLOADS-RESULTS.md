# Relay downloads — implementation results

The original marketing download page is absent from this checkout. Download documentation, redirect routes, manifests and packaging/release helpers are included; the external marketing website’s source repository is not identified. See [the discovery and release infrastructure report](RELAY-DOWNLOADS.md) for exact paths and contracts.

The new public page is **http://localhost:8088/download** after starting the current source with `CARGO_BUILD_JOBS=1 pnpm dev` in the existing devcontainer. Run `pnpm install --frozen-lockfile` and `pnpm i18n:compile` first if dependencies/catalogs need refreshing. The existing app-side download buttons now open this deployment’s page.

## Configuration requirement

The shipped release catalog is intentionally empty. Set the actual Relay `package_origin`, or list published asset URLs and their metadata in `relay_app/assets/assets/relay-downloads.json`. Until configured, unavailable builds remain disabled and the browser app remains accessible. No releases were published and no binaries were uploaded or replaced. Production configuration must use the owned Relay release service and permitted CORS/CSP origins; see the main report for details.

## Validation

| Check | Result | Exit code |
| --- | --- | --- |
| Full app TypeScript | Passed | 0 |
| Release metadata tests | 10 passed | 0 |
| Production Rspack build | Passed in 40.11 seconds, separate temporary output | 0 |
| Browser desktop and mobile | Actual production route rendered; zero JavaScript exceptions; 390px mobile viewport without horizontal overflow | 0 |
| Browser interactions | Stable/Canary isolation, architecture selection, version/size/notes display, absent formats, error and retry recovery passed | 0 |
| Biome | 18 source/test files checked; no diagnostics | 0 |
| Source path audit | 32,059 imports and 45 Cargo manifests; no unresolved paths | 0 |
| Git whitespace | Passed | 0 |

The production build reports existing CSS ordering warnings among unrelated application modal/style chunks. It produced no build errors. The full React app was built, including the lazy download route and copied catalog; a new site framework or alternate app implementation was not introduced.

Browser tests used a temporary server on port 8093 with only the separately generated build and public discovery/assets forwarded to the existing local service. The preview was stopped after testing. Synthetic artifact URLs were injected only in test memory; no test download was clicked and no fake release was added to the public catalog. Native Windows/macOS installers were not rebuilt or published in this page task.

## Changed existing files

- `relay_app/src/app/Routes.ts`
- `relay_app/src/app/router/RouterConstants.ts`
- `relay_app/src/app/router/routes/RootRoutes.tsx`
- `relay_app/src/app/router/routes/RouterRoutes.ts`
- `relay_app/src/app/router/components/RootComponent.tsx`
- `relay_app/src/features/app/config/I18nDisplayConstants.ts`
- `relay_app/src/features/updater/commands/UpdaterModalCommands.tsx`
- `relay_app/src/features/voice/components/modals/screen_share_picker_modal/DesktopDownloadCta.tsx`
- `relay_app/src/features/app/components/layout/sidebar_nav/DownloadButton.tsx`
- `relay_app/src/features/app/components/layout/app_layout/nagbars/DesktopDownloadNagbar.tsx`
- `relay_app/src/features/app/components/layout/app_layout/nagbars/CorruptedInstallationNagbar.tsx`
- `relay_app/src/features/user/components/modals/tabs/UserVoiceTab.tsx`
- `relay_app/src/features/app/state/Updater.ts`
- `relay_app/rspack.config.mjs`

## Added files

- `relay_app/assets/assets/relay-downloads.json`
- `relay_app/src/features/download/DownloadMetadata.ts`
- `relay_app/src/features/download/DownloadPage.tsx`
- `relay_app/src/features/download/DownloadPage.module.css`
- `tools/relay/download-metadata.test.mjs`
- `docs/RELAY-DOWNLOADS.md`
- `docs/RELAY-DOWNLOADS-RESULTS.md`

The CSS module declaration (`DownloadPage.module.css.d.ts`) was generated with the existing typed-css-modules tool and remains ignored according to repository policy.

## Recovery and evidence

Pre-edit copies of the changed existing files, the change list and logs are preserved in `.orvix/relay-rebrand/download-page-20261108T224251615835Z/`. Previous rebrand snapshots and backups were not reused or overwritten. No database, Docker volume or Nexora resource was modified; no commit or push was made.

Evidence: `frontend-build-final.log`, `typecheck-final.log`, `metadata-tests.log`, `browser-final.log`, `format-check.log`, `path-audit.log`, `download-desktop.png`, and `download-mobile.png`.
