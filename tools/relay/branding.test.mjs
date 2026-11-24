import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {test} from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name));
const sharp = createRequire(path.join(root, 'relay_api/package.json'))('sharp');
const manifest = JSON.parse(read('branding/generated/manifest.json'));
test('original RGBA logo is preserved', async () => {
	const source = read(manifest.source),
		meta = await sharp(source).metadata();
	assert.equal(meta.hasAlpha, true);
	assert.equal(crypto.createHash('sha256').update(source).digest('hex'), manifest.sourceSha256);
});
test('all declared generated assets exist', () => {
	for (const name of manifest.outputs) assert.ok(read(name).length > 0, name);
});
test('web icons use the declared resolutions and preserve alpha', async () => {
	for (const n of [16, 32]) {
		const meta = await sharp(read(`relay_static/web/favicon-${n}x${n}.png`)).metadata();
		assert.equal(meta.width, n);
		assert.equal(meta.height, n);
		assert.equal(meta.hasAlpha, true);
	}
});
test('Apple and maskable icons are opaque', async () => {
	for (const name of ['apple-touch-icon.png', 'maskable-512x512.png']) {
		const stats = await sharp(read(`relay_static/web/${name}`)).stats();
		assert.equal(stats.channels[3].min, 255);
	}
});
test('Windows ICO frames are valid PNG images at all seven sizes', async () => {
	const ico = read('relay_desktop/build_resources/icons-stable/icon.ico');
	assert.equal(ico.readUInt16LE(2), 1);
	assert.equal(ico.readUInt16LE(4), 7);
	for (let i = 0; i < 7; i++) {
		const pos = 6 + 16 * i,
			n = ico[pos] || 256,
			len = ico.readUInt32LE(pos + 8),
			off = ico.readUInt32LE(pos + 12);
		const meta = await sharp(ico.subarray(off, off + len)).metadata();
		assert.equal(meta.width, n);
		assert.equal(meta.height, n);
	}
});
test('macOS ICNS has four complete PNG representations', async () => {
	const icns = read('relay_desktop/build_resources/icons-stable/_compiled/AppIcon.icns');
	assert.equal(icns.toString('ascii', 0, 4), 'icns');
	assert.equal(icns.readUInt32BE(4), icns.length);
	let pos = 8,
		count = 0;
	while (pos < icns.length) {
		const len = icns.readUInt32BE(pos + 4);
		assert.ok(len > 8);
		await sharp(icns.subarray(pos + 8, pos + len)).metadata();
		pos += len;
		count++;
	}
	assert.equal(count, 4);
	assert.equal(pos, icns.length);
});
test('the three release channels share the Relay icon without changing their IDs', () => {
	const stable = read('relay_desktop/build_resources/icons-stable/icon.ico');
	for (const channel of ['canary', 'development'])
		assert.ok(stable.equals(read(`relay_desktop/build_resources/icons-${channel}/icon.ico`)));
	const identity = read('relay_desktop/src/common/DesktopIdentity.ts').toString();
	assert.match(identity, /stable: 'Relay'/);
	assert.match(identity, /stable: 'app\.orvix'/);
	assert.match(identity, /stable: 'Orvix\.Orvix'/);
});
test('desktop account/profile directories stay compatible', () => {
	const paths = read('relay_desktop/src/common/UserDataPath.ts').toString();
	assert.match(paths, /stable: 'orvix'/);
	assert.match(paths, /canary: 'orvixcanary'/);
	assert.match(paths, /development: 'orvixdevelopment'/);
});
test('shared authentication and navigation marks use the Relay source image', () => {
	const svg = read('relay_app/src/media/images/relay-logo-color.svg').toString();
	assert.match(svg, /aria-label="Relay"/);
	assert.match(svg, /data:image\/png;base64,/);
	const icon = read('relay_app/src/features/ui/components/icons/RelayIconMark.tsx').toString();
	assert.match(icon, /<RelayMark/);
	for (const name of ['relay_admin/static/relay-wordmark.svg', 'relay_app/src/media/images/relay-wordmark.svg'])
		assert.match(read(name).toString(), />relay<\/text>/);
});
test('browser title, PWA identity, routes and port remain correct', () => {
	assert.match(read('relay_app/index.html').toString(), /<title>Relay<\/title>/);
	const generator = read('relay_app/scripts/build/rspack/static-files.mjs').toString();
	assert.match(generator, /short_name: 'Relay'/);
	assert.match(generator, /maskable-512x512\.png/);
	assert.match(read('tools/dev/src/manifest.rs').toString(), /DEV_PROXY_PORT: u16 = 8088/);
	assert.match(read('.devcontainer/docker-compose.yml').toString(), /name: orvix-dev/);
	assert.match(read('relay_api/src/api/database/PostgresKvCodec.ts').toString(), /ENCODED_TYPE_KEY = '__fluxer_type'/);
});
