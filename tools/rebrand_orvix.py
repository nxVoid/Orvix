#!/usr/bin/env python3
"""Prepare an isolated Orvix source tree without touching a running checkout."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPLACEMENTS = {'FLUXER': 'ORVIX', 'Fluxer': 'Orvix', 'fluxer': 'orvix'}
# Published upstream resources and attribution remain truthful until fork URLs exist.
PROTECTED = re.compile(
    r'(?:https?|wss?|git|ssh)://[^\s<>"\x27`\\]+'
    r'|github\.com/fluxerapp/[^\s<>"\x27`\\]+'
    r'|(?:[\w*-]+\.)*fluxer\.(?:com|app|media)(?:/[^\s<>"\x27`\\]+)?'
    r'|[\w.+-]+@[\w.-]*fluxer[\w.-]*\.[A-Za-z]+'
    r'|Fluxer Platform AB'
    # Persistent wire identifiers are independent of product branding.
    r'|__fluxer_type|__fluxer_schema_migrations'
)


def rename(value):
    for old, new in REPLACEMENTS.items():
        value = value.replace(old, new)
    return value


def transform(text):
    protected = []

    def hold(match):
        protected.append(match.group())
        return f'\x01{len(protected) - 1}\x02'

    text = PROTECTED.sub(hold, text)
    lines = []
    for line in text.splitlines(keepends=True):
        # License and authorship statements must not become claims by the fork.
        lines.append(line if re.search(r'copyright|SPDX-', line, re.I) else rename(line))
    text = ''.join(lines)
    for index, value in enumerate(protected):
        text = text.replace(f'\x01{index}\x02', value)
    return text


def finish_branding(output):
    # These describe a published Electron artifact, not this fork's identity.
    # Changing patch bytes or release identifiers invalidates pinned checksums.
    upstream_electron = ROOT / 'fluxer_desktop/electron'
    if upstream_electron.exists():
        for original in upstream_electron.rglob('*'):
            if original.is_file() and (original.name == 'runtime.json' or original.suffix == '.patch'):
                target = output / 'orvix_desktop/electron' / original.relative_to(upstream_electron)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(original.read_bytes())
    wordmarks = [
        'orvix_admin/static/orvix-wordmark.svg',
        'orvix_app/src/media/images/orvix-wordmark.svg',
        'orvix_app/src/media/images/orvix-logo-wordmark-monochrome.svg',
        'orvix_static/marketing/branding/logo-color.svg',
        'orvix_static/marketing/branding/logo-white.svg',
    ]
    for name in wordmarks:
        target = output / name
        if not target.exists():
            continue
        original = target.read_text()
        notices = '\n'.join(re.findall(r'<!--[^>]*SPDX-[^>]*-->', original))
        color = '#ffffff' if 'white' in name else '#4641d9' if 'color' in name else 'currentColor'
        target.write_text(
            f'{notices}\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 200" '
            f'role="img" aria-label="Orvix"><title>Orvix</title>'
            f'<text x="12" y="155" fill="{color}" font-family="Arial,Helvetica,sans-serif" '
            f'font-size="185" font-weight="700" letter-spacing="-8">Orvix</text></svg>\n'
        )
    (output / 'README.md').write_text('''# Orvix

Orvix is an independently developed fork of the open source instant messaging and voice application [Fluxer](https://github.com/fluxerapp/fluxer).

## Development

Use the supplied devcontainer for a fresh development environment. Internal modules use `orvix_*`, JavaScript packages use `@orvix/*`, and configuration variables use `ORVIX_*`.

```sh
pnpm install --frozen-lockfile
pnpm i18n:compile
pnpm dev
```

The development web app is served on `http://localhost:8088`; the admin panel is at `/admin` and its internal development port is `3020`.

See [REBRANDING.md](REBRANDING.md) before deploying this renamed source tree.

## Attribution and license

Original authorship and copyright notices are preserved. Orvix retains the original [AGPL-3.0-or-later license](LICENSE). Individual assets retain their own license notices.
''')
    (output / 'REBRANDING.md').write_text('''# Orvix source migration

This tree is isolated from the running Orvix and Nexora containers. No service or database was changed to generate it.

## What changed

Module directories, Rust packages, JavaScript package names and imports, environment variables, development paths, Docker project/volume names, application strings, desktop application identifiers, and wordmarks now use Orvix. Historical copyright, authorship, published upstream URLs, and Go module import URLs remain intact.

## Before activation

- Install dependencies in this tree; do not reuse the original `node_modules` symlinks, which point to the old package names and paths.
- Recompile localization catalogs with `pnpm i18n:compile`, then build the renamed services.
- Translate private/local configuration from `FLUXER_*` to `ORVIX_*`. Secret values were not copied into this tree.
- Existing persisted instance branding (for example `Void`) overrides source defaults. Change the instance product name to Orvix in admin branding settings when activating the fork.
- Build your own Docker images. Old Fluxer images do not implement the renamed `ORVIX_*` configuration interface. Select an owned registry/repository before publishing.
- Select your own public domain, GitHub repository, update servers, support links, and signing identities. Preserved upstream endpoints are not Orvix infrastructure.
- Plan a separate migration for existing Docker volume names, database/bucket identifiers, OAuth redirect URIs, desktop app identifiers, cookies, and browser storage keys. Renaming source does not migrate stored data.
- Start this tree on separate ports/volumes first. Switching the current workspace mount and processes requires a deliberate service transition; do not run a broad Compose down command against the existing environment.

Binary artwork, fonts, and media retain their original contents except the replaced SVG wordmarks. A full production build and end-to-end deployment test are still required before activation.
''')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('output must be outside the live checkout')
    if output.exists():
        parser.error('output must not already exist')
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    files = [name for name in files if name]
    destinations = [rename(name) for name in files]
    if len(set(destinations)) != len(destinations):
        parser.error('renaming would create conflicting paths')
    output.mkdir(parents=True)
    manifest = {'source': str(ROOT), 'output': str(output), 'files': [], 'renamed': 0, 'edited': 0}
    for name, destination in zip(files, destinations):
        source = ROOT / name
        target = output / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_symlink():
            target.symlink_to(rename(str(source.readlink())))
            continue
        data = source.read_bytes()
        converted = data
        if b'\0' not in data:
            try:
                converted = transform(data.decode('utf-8')).encode('utf-8')
            except UnicodeDecodeError:
                pass
        target.write_bytes(converted)
        target.chmod(source.stat().st_mode & 0o777)
        manifest['renamed'] += name != destination
        manifest['edited'] += converted != data
        manifest['files'].append({'source': name, 'target': destination,
                                  'source_sha256': hashlib.sha256(data).hexdigest()})
    finish_branding(output)
    (output / 'ORVIX_RENAME_MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({key: value if key != 'files' else len(value) for key, value in manifest.items()}, indent=2))


if __name__ == '__main__':
    main()
