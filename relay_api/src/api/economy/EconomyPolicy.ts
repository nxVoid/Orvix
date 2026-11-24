// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';

export class EconomyError extends Error {
	constructor(
		public readonly code: string,
		public readonly status: 400 | 403 | 404 | 409 | 503 = 409,
	) {
		super(code);
	}
}

export function periodBounds(period: string, now: Date, starts?: Date | null, ends?: Date | null) {
	const start = new Date(now);
	start.setUTCHours(0, 0, 0, 0);
	if (period === 'weekly') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
	if (period === 'event') {
		if (!starts || !ends || now < starts || now >= ends) throw new EconomyError('MISSION_INACTIVE');
		return {key: starts.toISOString(), end: ends};
	}
	const reset = start.getTime() + (period === 'weekly' ? 7 : 1) * 86400000;
	const end = new Date(Math.min(reset, ends?.getTime() ?? reset));
	return {key: start.toISOString().slice(0, 10), end};
}

export function meaningfulMessage(content: string): string | null {
	const normalized = content
		.normalize('NFKC')
		.replace(/https?:\/\/\S+|<[^>]+>/gu, '')
		.toLocaleLowerCase('en-US')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
	if (normalized.length < 12 || new Set(normalized.replaceAll(' ', '')).size < 5 || normalized.split(/\s+/u).length < 3)
		return null;
	return createHash('sha256').update(normalized).digest('hex');
}

export function operationFingerprint(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
