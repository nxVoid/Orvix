import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = path.join(root, '.orvix/relay-rebrand');
fs.mkdirSync(base, {recursive: true, mode: 0o700});
const pointer = path.join(base, 'latest');
export const snapshot = fs.existsSync(pointer)
	? fs.readFileSync(pointer, 'utf8').trim()
	: path.join(base, new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(snapshot, {recursive: true, mode: 0o700});
fs.writeFileSync(pointer, snapshot, {mode: 0o600});
const manifestPath = path.join(snapshot, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
export const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
export function write(name, data) {
	const target = path.resolve(root, name);
	if (!target.startsWith(root + path.sep)) throw new Error('Outside workspace');
	const next = Buffer.from(data);
	const exists = fs.existsSync(target);
	const old = exists ? fs.readFileSync(target) : null;
	if (old?.equals(next)) return;
	if (!manifest[name]) {
		if (exists) {
			const backup = path.join(snapshot, 'files', name);
			fs.mkdirSync(path.dirname(backup), {recursive: true});
			fs.writeFileSync(backup, old);
		}
		manifest[name] = {before: old ? hash(old) : null, mode: exists ? fs.statSync(target).mode : 0o644};
	}
	fs.mkdirSync(path.dirname(target), {recursive: true});
	fs.writeFileSync(target, next);
	manifest[name].after = hash(next);
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {mode: 0o600});
}
export function edit(name, transform) {
	write(name, transform(fs.readFileSync(path.join(root, name), 'utf8')));
}
