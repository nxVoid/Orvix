import fs from 'node:fs';
import path from 'node:path';
import {edit, snapshot} from './workspace.mjs';

const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
const technical = /X-Orvix-[\w-]+|data-orvix[\w-]*|orvix[:._-][\w:./-]+|@orvix\/[\w/-]+|ORVIX_[A-Z0-9_]+|__fluxer_\w+/g;
for (const name of Object.keys(manifest)) {
	const backup = path.join(snapshot, 'files', name);
	if (!/\.(ts|tsx|rs|json|html)$/.test(name) || !fs.existsSync(backup)) continue;
	const before = fs.readFileSync(backup, 'utf8');
	edit(name, (s) => {
		for (const token of new Set(before.match(technical) ?? [])) {
			const renamed = token.replace(/\b(?:Orvix|Fluxer|ORVIX|FLUXER|orvix|fluxer)\b/g, 'Relay');
			if (token !== renamed) s = s.replaceAll(renamed, token);
		}
		return s;
	});
}
