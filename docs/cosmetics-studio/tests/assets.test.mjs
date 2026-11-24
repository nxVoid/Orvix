// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(new URL('../../../relay_api/package.json', import.meta.url));
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const collection = JSON.parse(await readFile(new URL('manifests/collection-v2.json', root), 'utf8'));

for (const product of collection.products) {
	const directory = new URL(product.directory + '/', root);
	const metadata = JSON.parse(await readFile(new URL('metadata.json', directory), 'utf8'));
	test(`${product.id}: identity, budgets and fallback`, async () => {
		assert.equal(metadata.id, product.id);
		assert.ok(['reviewed', 'candidate'].includes(metadata.quality_state));
		for (const name of [metadata.asset, metadata.poster]) {
			const bytes = await readFile(new URL(name, directory));
			assert.ok(bytes.length <= metadata.budgets.max_asset_bytes, name);
		}
		assert.ok(metadata.animated === false ? metadata.motion.duration_seconds === 0 : metadata.motion.duration_seconds >= 12);
	});
	if (metadata.category === 'avatar_frame') {
		for (const size of metadata.sizes) {
			test(`${product.id}: ${metadata.quality_state === 'candidate' && size === 32 ? 'candidate rejection gate' : 'transparent face aperture'} at ${size}px`, async () => {
				const source = await readFile(new URL(metadata.poster, directory));
				const {data, info} = await sharp(source).resize(size, size).ensureAlpha().raw().toBuffer({resolveWithObject: true});
				const protectedRadius = size * (metadata.protected_aperture_ratio ? metadata.protected_aperture_ratio - .02 : .37);
				let maximumAlpha = 0;
				for (let y = 0; y < size; y++) {
					for (let x = 0; x < size; x++) {
						if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) < protectedRadius) {
							maximumAlpha = Math.max(maximumAlpha, data[(y * info.width + x) * info.channels + 3]);
						}
					}
				}
				if (metadata.quality_state === 'candidate' && size === 32) {
					assert.ok(maximumAlpha > 0, 'Candidate requires a renewed review before promotion');
				} else {
					assert.equal(maximumAlpha, 0);
				}
			});
		}
	}
}

function luminance(hex) {
	const channels = hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16) / 255)
		.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
	return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

test('studio text tokens meet WCAG AA on all studio surfaces', () => {
	for (const surface of ['0d0d12', '16161e', '1b1b25']) {
		for (const text of ['f2f0f7', 'a5a2b3']) {
			const contrast = (luminance(text) + .05) / (luminance(surface) + .05);
			assert.ok(contrast >= 4.5, `${text} on ${surface}: ${contrast}`);
		}
	}
});


test('unreviewed crown artwork cannot replace an owned catalog product', async () => {
	const registry = await readFile(new URL('../../../relay_api/src/api/economy/StudioAssetRegistry.ts', import.meta.url), 'utf8');
	const upgrades = registry.slice(registry.indexOf('export const STUDIO_UPGRADES'));
	assert.ok(!/"id":\s*"amethyst_crown"/u.test(upgrades));
});
