// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	decodeValue,
	encodeValue,
	normalizeRebrandedKey,
	normalizeRebrandedValue,
} from '@app/api/database/PostgresKvCodec';
import {keyFromColumns} from '@app/api/database/PostgresKvQueryExecutor';
import type {UserRow} from '@app/api/database/types/UserTypes';
import {User} from '@app/api/models/User';
import {PremiumFlags} from '@relay/constants/src/UserConstants';
import {describe, expect, it} from 'vitest';

describe('persisted KV format compatibility', () => {
	it('pins key bytes to the original storage identity rather than product branding', () => {
		expect(keyFromColumns(['user_id'], {user_id: 42n})).toBe('{"__fluxer_type":"bigint","value":"42"}');
	});
	for (const marker of ['__fluxer_type', '__orvix_type']) {
		it(`loads ${marker} flags as precise BigInts before constructing a user`, () => {
			const flags = (1n << 57n) | (1n << 37n);
			const raw = {
				user_id: {[marker]: 'bigint', value: '9007199254740993'},
				username: 'legacy_fixture',
				discriminator: 0,
				flags: {[marker]: 'bigint', value: flags.toString()},
				version: 1,
			};
			// The pre-fix decoder returned raw.flags itself, reproducing the reported stack.
			expect(() => (raw.flags as unknown as bigint) & 1n).toThrow(TypeError);
			const user = new User(decodeValue(raw) as UserRow);
			expect(user.flags).toBe(flags);
			expect(user.id).toBe(9007199254740993n);
			expect(user.premiumFlags & PremiumFlags.DISCRIMINATOR).not.toBe(0);
		});
		it(`round-trips dates, buffers, sets and maps from ${marker}`, () => {
			const data = {
				date: new Date('2025-01-01T00:00:00Z'),
				bytes: Buffer.from('fixture'),
				set: new Set([3n]),
				map: new Map([['id', 4n]]),
			};
			const encoded = JSON.parse(JSON.stringify(encodeValue(data)).replaceAll('__fluxer_type', marker));
			expect(decodeValue(encoded)).toEqual(data);
		});
	}
	it('normalizes rebrand envelopes without changing ordinary strings', () => {
		const literal = '{"__orvix_type":"bigint","value":"7"}';
		expect(normalizeRebrandedValue({note: literal})).toEqual({note: literal});
		const key = `${literal}\u001f${JSON.stringify(literal)}`;
		expect(normalizeRebrandedKey(key)).toBe(
			`${literal.replace('__orvix_type', '__fluxer_type')}\u001f${JSON.stringify(literal)}`,
		);
	});
	it('refuses conflicting tags and ambiguous migrations', () => {
		expect(() => decodeValue({__fluxer_type: 'bigint', __orvix_type: 'date', value: '1'})).toThrow();
		expect(() => normalizeRebrandedValue({__orvix_type: 'bigint', value: '1', extra: true})).toThrow();
	});
});
