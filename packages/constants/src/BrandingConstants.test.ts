// SPDX-License-Identifier: AGPL-3.0-or-later
import {describe, expect, it} from 'vitest';
import {PRODUCT_NAME, productDisplayName} from './BrandingConstants';

describe('Relay product display compatibility', () => {
	it('uses Relay for the default product', () => expect(PRODUCT_NAME).toBe('Relay'));
	for (const name of [null, undefined, '', ' Orvix ', 'Fluxer', 'ORVIX', 'fluxer'])
		it(`presents legacy/default display name ${String(name)}`, () => expect(productDisplayName(name)).toBe('Relay'));
	it('preserves custom instance branding', () => expect(productDisplayName('  Friends Space  ')).toBe('Friends Space'));
	it('does not reinterpret identifiers or domains', () => {
		for (const name of ['app.orvix', 'orvix.example.com', 'Orvix Club', '__fluxer_type'])
			expect(productDisplayName(name)).toBe(name);
	});
});
