# Relay

Relay is an independently developed fork of the open source instant messaging and voice application [Fluxer](https://github.com/fluxerapp/fluxer).

## Development

Use the supplied devcontainer for a fresh development environment. Internal modules use `relay_*`, JavaScript packages use `@relay/*`, and configuration variables use `ORVIX_*`.

```sh
pnpm install --frozen-lockfile
pnpm i18n:compile
pnpm dev
```

The development web app is served on `http://localhost:8088`; the admin panel is at `/admin` and its internal development port is `3020`.

See [branding/RELAY.md](branding/RELAY.md) for the Relay branding and compatibility policy. See [REBRANDING.md](REBRANDING.md) before deploying this renamed source tree.

## Attribution and license

Original authorship and copyright notices are preserved. Relay retains the original [AGPL-3.0-or-later license](LICENSE). Individual assets retain their own license notices.
