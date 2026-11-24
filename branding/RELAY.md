# Relay identity and compatibility

The product and first-party source workspace are Relay. Service directories use `relay_*`, JavaScript packages use `@relay/*`, and Rust development tools are `relay-dev` and `relay-ci`. The original Fluxer license, author notices, and font licenses remain authoritative.

## Existing installations and data

The technical migration continues the previous branding work. It does not recreate databases, containers, volumes, accounts, uploads, or the source repository. New recovery files live in a separate timestamped `technical-*` directory under `.orvix/relay-rebrand/`. Existing snapshots and dumps remain in place.

These legacy identifiers are intentional compatibility contracts:

- `.orvix/dev`, the `orvix-dev` Docker Compose project, named volumes, the existing Helm chart/resource naming default, cluster cookie, and existing `ORVIX_*` environment variables retain access to the existing development environment. PostgreSQL names, roles, table names, S3 buckets, secrets, and uploads are unchanged.
- Browser and desktop storage keys, profile directories (`orvix`, `orvixcanary`, `orvixdevelopment`), portable account directories, encryption markers such as `__fluxer_type`, epoch values, and internal serialized fields retain their existing values. Relay opens those same profiles directly; no copy/delete migration is needed.
- `X-Orvix-*` headers, `orvix.*` protobuf namespaces and generated descriptors, mobile SSO callback URLs, RPC keys, validation error values, native diagnostic contracts, and updater module names retain their wire values. Renaming the source packages does not change those formats.
- macOS bundle/team/signing identifiers, Windows Velopack/Squirrel IDs and AUMIDs, Linux package names and Flatpak IDs retain installed identities. Changing them would require a separate signed installer transition. Installer titles, executables, product names and artwork use Relay.
- `relay://` and `relay-development://` are the desktop protocol schemes. Existing `orvix://` and `orvix-development://` links remain registered and accepted. Their existing foreground-account restrictions still apply.
- `--relay-portable` and `RELAY_PORTABLE` are accepted alongside the old portable controls. `RELAY_DESKTOP_PACKAGE_ORIGIN` overrides the update origin, with `ORVIX_DESKTOP_PACKAGE_ORIGIN` retained as a fallback.
- Historical documents, legacy migration tools/snapshots, upstream domains, legal notices, external app registrations and translation catalog history may still contain Fluxer or Orvix. Do not mechanically rewrite those values.

## Running locally

From the existing checkout (its directory may still be named `Orvix`):

```sh
pnpm install --frozen-lockfile
pnpm i18n:compile
CARGO_BUILD_JOBS=1 pnpm dev
```

Use the existing devcontainer and its existing infrastructure configuration. The app is at `http://localhost:8088`, and the admin panel at `http://localhost:8088/admin`. For infrastructure status, use `pnpm dev:infra:status`. For desktop development rebuild native modules with `pnpm dev:desktop:deps`, then use `pnpm dev:desktop:app` and `pnpm dev:desktop:run`. Keep builds sequential.

## Release requirements

Stable/canary public web, download, signing and update endpoints still refer to the inherited deployment. Before distributing Relay, configure an owned and signed release feed with `RELAY_DESKTOP_PACKAGE_ORIGIN`, update deployment-owned public URLs and obtain the appropriate signing credentials. Do not distribute a build using the upstream production feed: it can return upstream modules or installers. No Relay domain or signing identity was invented during this source migration.

Linux/WSL checks do not establish that Windows or macOS installers are signed, install correctly, or upgrade an installed production client. Those checks require the target OS and its signing/release environment. Erlang compilation requires the Erlang/rebar3 toolchain.
