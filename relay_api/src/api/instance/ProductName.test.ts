// SPDX-License-Identifier: AGPL-3.0-or-later
import {Config} from '@app/api/Config';
import {getDefaultProductName, getInstanceProductName, setCachedProductName} from '@app/api/instance/ProductName';
import {afterEach, describe, expect, it} from 'vitest';

const original = Config.instance.branding.productName;
afterEach(() => {
	Config.instance.branding.productName = original;
	setCachedProductName(null);
});
describe('Relay display names without a data migration', () => {
	for (const legacy of ['Orvix', 'Fluxer', ''])
		it(`presents stored ${legacy || 'empty'} branding as Relay without changing the stored value`, () => {
			Config.instance.branding.productName = legacy;
			setCachedProductName(legacy);
			expect(getDefaultProductName()).toBe('Relay');
			expect(getInstanceProductName()).toBe('Relay');
			expect(Config.instance.branding.productName).toBe(legacy);
		});
	it('preserves a custom instance name', () => {
		setCachedProductName('Friends Space');
		expect(getInstanceProductName()).toBe('Friends Space');
	});
});
