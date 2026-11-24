# Orvix source migration

The validated renamed source has been applied to the main checkout. The previous source is retained under `.orvix-migration/legacy-source` and a PostgreSQL backup is available under `.orvix-migration/postgres-before-rebrand.dump`. Nexora was not modified. See [TEST_ET.md](TEST_ET.md) for the Windows artifact and current runtime test status.

## What changed

Module directories, Rust packages, JavaScript package names and imports, environment variables, development paths, Docker project/volume names, application strings, desktop application identifiers, and wordmarks now use Orvix. Historical copyright, authorship, published upstream URLs, and Go module import URLs remain intact.

## Deployment notes

- Install dependencies in this tree; do not reuse the original `node_modules` symlinks, which point to the old package names and paths.
- Recompile localization catalogs with `pnpm i18n:compile`, then build the renamed services.
- Translate private/local configuration from `FLUXER_*` to `ORVIX_*`. Secret values were not copied into this tree.
- The persisted instance product name was updated from Void to Orvix. Existing physical database and bucket names are deliberately retained by development configuration.
- Build your own Docker images. Old Fluxer images do not implement the renamed `ORVIX_*` configuration interface. Select an owned registry/repository before publishing.
- Select your own public domain, GitHub repository, update servers, support links, and signing identities. Preserved upstream endpoints are not Orvix infrastructure.
- Plan a separate migration for existing Docker volume names, database/bucket identifiers, OAuth redirect URIs, desktop app identifiers, cookies, and browser storage keys. Renaming source does not migrate stored data.
- Start this tree on separate ports/volumes first. Switching the current workspace mount and processes requires a deliberate service transition; do not run a broad Compose down command against the existing environment.

Binary artwork, fonts, and media retain their original contents except the replaced SVG wordmarks. The Windows x64 local test build is available under `artifacts/`. Full production signing, publishing, and end-to-end service tests remain separate from this local build.
