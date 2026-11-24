import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const snapshot = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node tools/relay/rollback.mjs <snapshot-directory> [--apply]');
const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
for (const [name, entry] of Object.entries(manifest)) {
	const target = path.resolve(root, name);
	if (!target.startsWith(root + path.sep)) throw new Error('Unsafe path');
	if (!fs.existsSync(target) || hash(fs.readFileSync(target)) !== entry.after)
		throw new Error(`Later edits detected; refusing rollback: ${name}`);
	if (entry.before !== null && hash(fs.readFileSync(path.join(snapshot, 'files', name))) !== entry.before)
		throw new Error('Invalid backup');
}
if (process.argv.includes('--apply'))
	for (const [name, entry] of Object.entries(manifest)) {
		const target = path.join(root, name);
		if (entry.before === null) fs.unlinkSync(target);
		else {
			fs.copyFileSync(path.join(snapshot, 'files', name), target);
			fs.chmodSync(target, entry.mode);
		}
	}
console.log(JSON.stringify({files: Object.keys(manifest).length, applied: process.argv.includes('--apply')}));
