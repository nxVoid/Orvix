#!/usr/bin/env python3
"""Apply the validated source tree, keeping the previous tree for rollback."""

import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / '.orvix-migration/source'
BACKUP = ROOT / '.orvix-migration/legacy-source'


def main():
    if BACKUP.exists():
        raise SystemExit('A previous migration backup already exists; refusing to overwrite it.')
    manifest = json.loads((STAGING / 'ORVIX_RENAME_MANIFEST.json').read_text())
    checks = ['api-typecheck', 'app-typecheck', 'admin-check']
    for check in checks:
        if (ROOT / f'.orvix-migration/{check}.exit').read_text().strip() != '0':
            raise SystemExit(f'{check} must pass before applying the source migration')
    conflicts = []
    for entry in manifest['files']:
        source = ROOT / entry['source']
        if entry['source'] == '.gitignore':
            continue
        if hashlib.sha256(source.read_bytes()).hexdigest() != entry['source_sha256']:
            conflicts.append(entry['source'])
    if conflicts:
        raise SystemExit(f'Source changed since the snapshot; merge these first: {conflicts}')
    private_files = {relative: (ROOT / relative).read_bytes()
                     for relative in ['.env.local', 'config/env/local.env']
                     if (ROOT / relative).exists()}
    # Keep the migration tools alongside the source they operate on.
    for name in ['rebrand_orvix.py', 'apply_orvix_rebrand.py']:
        shutil.copy2(ROOT / 'tools' / name, STAGING / 'tools' / name)
    BACKUP.mkdir()
    original_roots = sorted({Path(entry['source']).parts[0] for entry in manifest['files']})
    for name in original_roots:
        source = ROOT / name
        if source.exists() or source.is_symlink():
            shutil.move(str(source), str(BACKUP / name))
    if (ROOT / 'node_modules').exists():
        shutil.move(str(ROOT / 'node_modules'), str(BACKUP / 'node_modules'))
    skip = shutil.ignore_patterns('node_modules', 'target', '_build', 'dist', 'dist-electron', '__pycache__')
    for source in STAGING.iterdir():
        if source.name in {'node_modules', 'target', 'ORVIX_RENAME_MANIFEST.json'}:
            continue
        target = ROOT / source.name
        if source.is_dir():
            shutil.copytree(source, target, ignore=skip, symlinks=True, dirs_exist_ok=True)
        elif source.is_file():
            shutil.copy2(source, target)
    for relative, contents in private_files.items():
        source = ROOT / relative
        backup = BACKUP / (relative.replace('/', '__') + '.private')
        backup.write_bytes(contents)
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(contents.decode().replace('FLUXER_', 'ORVIX_'))
    if (ROOT / '.fluxer').exists() and not (ROOT / '.orvix').exists():
        shutil.copytree(ROOT / '.fluxer', ROOT / '.orvix')
        for pid in (ROOT / '.orvix').rglob('*.pid'):
            pid.unlink()
    (ROOT / '.orvix-migration/applied.json').write_text(json.dumps({
        'root': str(ROOT), 'backup': str(BACKUP), 'source': str(STAGING),
        'database_backup': '.orvix-migration/postgres-before-rebrand.dump',
    }, indent=2) + '\n')
    print(f'Applied Orvix source to {ROOT}; previous sources retained in {BACKUP}')


if __name__ == '__main__':
    main()
