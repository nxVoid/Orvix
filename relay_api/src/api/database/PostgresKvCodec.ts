// SPDX-License-Identifier: AGPL-3.0-or-later

import {LocalDate} from '@app/api/database/LocalDate';

// This is the original, persisted format. Never rename it with application branding.
const ENCODED_TYPE_KEY = '__fluxer_type';
const REBRANDED_TYPE_KEY = '__orvix_type';
const TAGS = new Set(['bigint', 'date', 'buffer', 'set', 'map', 'local_date']);
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

export function encodeValue(value: unknown): unknown {
	if (value === null || value === undefined) return null;
	if (typeof value === 'bigint') return {[ENCODED_TYPE_KEY]: 'bigint', value: value.toString()};
	if (value instanceof Date) return {[ENCODED_TYPE_KEY]: 'date', value: value.toISOString()};
	if (Buffer.isBuffer(value)) return {[ENCODED_TYPE_KEY]: 'buffer', value: value.toString('base64')};
	if (value instanceof Set) return {[ENCODED_TYPE_KEY]: 'set', value: [...value.values()].map(encodeValue)};
	if (value instanceof Map) {
		return {
			[ENCODED_TYPE_KEY]: 'map',
			value: [...value.entries()].map(([key, entry]) => [encodeValue(key), encodeValue(entry)]),
		};
	}
	if (value instanceof LocalDate) {
		return {[ENCODED_TYPE_KEY]: 'local_date', value: value.toString()};
	}
	if (Array.isArray(value)) return value.map(encodeValue);
	if (isPlainObject(value)) {
		const encoded: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			encoded[key] = encodeValue(entry);
		}
		return encoded;
	}
	return value;
}

export function decodeValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(decodeValue);
	if (!isPlainObject(value)) return value;
	const encodedType = value[ENCODED_TYPE_KEY] ?? value[REBRANDED_TYPE_KEY];
	if (
		value[ENCODED_TYPE_KEY] !== undefined &&
		value[REBRANDED_TYPE_KEY] !== undefined &&
		value[ENCODED_TYPE_KEY] !== value[REBRANDED_TYPE_KEY]
	) {
		throw new Error('Conflicting Postgres KV type markers');
	}
	if (encodedType === 'bigint') return BigInt(String(value.value));
	if (encodedType === 'date') return new Date(String(value.value));
	if (encodedType === 'buffer') return Buffer.from(String(value.value), 'base64');
	if (encodedType === 'set') return new Set(((value.value as Array<unknown>) ?? []).map(decodeValue));
	if (encodedType === 'map') {
		return new Map(
			((value.value as Array<[unknown, unknown]>) ?? []).map(([key, entry]) => [decodeValue(key), decodeValue(entry)]),
		);
	}
	if (encodedType === 'local_date') return LocalDate.fromString(String(value.value));
	const decoded: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		decoded[key] = decodeValue(entry);
	}
	return decoded;
}

// Normalize only typed envelopes; user strings (including marker-looking strings) are untouched.
export function normalizeRebrandedValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeRebrandedValue);
	if (!isPlainObject(value)) return value;
	const tag = value[REBRANDED_TYPE_KEY];
	if (typeof tag === 'string' && TAGS.has(tag)) {
		if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'value')) {
			throw new Error('Ambiguous Postgres KV typed envelope; migration refused');
		}
		// Validate through the same decoder before writing the canonical envelope.
		decodeValue(value);
		return {[ENCODED_TYPE_KEY]: tag, value: normalizeRebrandedValue(value.value)};
	}
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeRebrandedValue(item)]));
}

export function normalizeRebrandedKey(key: string): string {
	if (!key.includes(REBRANDED_TYPE_KEY)) return key;
	return key
		.split('\u001f')
		.map((part) => {
			const parsed: unknown = JSON.parse(part);
			const normalized = normalizeRebrandedValue(parsed);
			return JSON.stringify(parsed) === JSON.stringify(normalized) ? part : JSON.stringify(normalized);
		})
		.join('\u001f');
}
