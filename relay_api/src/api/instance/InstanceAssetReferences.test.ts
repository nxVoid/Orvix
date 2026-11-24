// SPDX-License-Identifier: AGPL-3.0-or-later

import {resolveBrandingAsset} from '@app/api/instance/InstanceAssetReferences';
import {describe, expect, it} from 'vitest';

describe('public branding asset origins', () => {
	it.each(['http://192.168.1.28:18088', 'https://relay.example:8443'])(
		'resolves legacy bundled localhost icons against %s without changing stored values',
		(origin) => {
			for (const path of ['/web/android-chrome-512x512.png', '/web/favicon-32x32.png']) {
				const stored = `http://localhost:8088${path}`;
				expect(resolveBrandingAsset(stored, `${origin}/media`, origin)).toBe(`${origin}${path}`);
			}
		},
	);

	it('preserves external icons and other localhost assets', () => {
		for (const value of ['https://cdn.example/web/favicon-32x32.png', 'http://localhost:8088/custom-icon.png']) {
			expect(resolveBrandingAsset(value, 'https://relay.example/media', 'https://relay.example')).toBe(value);
		}
	});

	it('continues resolving uploaded references through the media endpoint', () => {
		expect(resolveBrandingAsset('branding/0/1234abcd.png', 'https://media.example', 'https://relay.example')).toBe(
			'https://media.example/branding/0/1234abcd.png',
		);
		expect(resolveBrandingAsset(null, 'https://media.example', 'https://relay.example')).toBeNull();
	});
});
