// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {http} from '@app/features/platform/transport/RestTransport';
import Users from '@app/features/user/state/Users';
import type {ProfileCosmeticResponse} from '@relay/schema/src/domains/user/UserResponseSchemas';
import {useEffect, useState} from 'react';

type PublicItem = ProfileCosmeticResponse & {user_id: string};
type Items = ReadonlyArray<PublicItem>;
type Resolver = (items: Items) => void;
type Cached = {until: number; items: Items};
const refreshEvent = 'relay-cosmetics-changed';
const ttl = 60_000;
const cache = new Map<string, Cached>();
let scope = '';
let pending = new Map<string, Array<Resolver>>();
let batchTimer: number | undefined;

function accountScope(): string {
	if (!Users.currentUserId) return '';
	try {
		return `${RuntimeConfig.transportApiEndpoint}:${Users.currentUserId}`;
	} catch {
		return '';
	}
}

function reset(next: string) {
	scope = next;
	cache.clear();
	window.clearTimeout(batchTimer);
	batchTimer = undefined;
	for (const listeners of pending.values()) {
		for (const listener of listeners) listener([]);
	}
	pending = new Map();
}

async function flush(expectedScope: string) {
	batchTimer = undefined;
	const requests = pending;
	pending = new Map();
	const ids = [...requests.keys()];
	for (let offset = 0; offset < ids.length; offset += 32) {
		const batch = ids.slice(offset, offset + 32);
		let items: Items = [];
		let failed = false;
		try {
			if (expectedScope === accountScope()) {
				items = (
					await http.post<{items: Array<PublicItem>}>('/economy/public-cosmetics', {
						body: {user_ids: batch},
						retries: 0,
					})
				).body.items;
			}
		} catch {
			failed = true;
		}
		for (const id of batch) {
			const sameScope = expectedScope === scope && expectedScope === accountScope();
			const found = sameScope ? items.filter((item) => item.user_id === id) : [];
			if (sameScope) {
				if (cache.size >= 2048) {
					const oldest = cache.keys().next().value;
					if (oldest !== undefined) cache.delete(oldest);
				}
				cache.set(id, {items: found, until: Date.now() + (failed ? 5 * ttl : ttl)});
			}
			for (const listener of requests.get(id) ?? []) listener(found);
		}
	}
}

function load(id: string, expectedScope: string, resolve: Resolver) {
	if (scope !== expectedScope) reset(expectedScope);
	const cached = cache.get(id);
	if (cached && cached.until > Date.now()) {
		resolve(cached.items);
		return;
	}
	const listeners = pending.get(id) ?? [];
	listeners.push(resolve);
	pending.set(id, listeners);
	batchTimer ??= window.setTimeout(() => void flush(expectedScope), 30);
}

export function invalidateOwnCosmetics() {
	const id = Users.currentUserId;
	if (id) cache.delete(id);
	window.dispatchEvent(new Event(refreshEvent));
}

export function usePublicCosmetic(id: string, category: string, disabled = false) {
	const expectedScope = disabled ? '' : accountScope();
	const identity = `${expectedScope}:${id}`;
	const [result, setResult] = useState<{identity: string; items: Items}>();
	useEffect(() => {
		if (!expectedScope || !/^\d{1,20}$/u.test(id)) return;
		let active = true;
		const refresh = () => {
			if (document.hidden || expectedScope !== accountScope()) return;
			load(id, expectedScope, (items) => {
				if (active) setResult({identity, items});
			});
		};
		const changed = () => {
			if (id === Users.currentUserId) refresh();
		};
		refresh();
		window.addEventListener(refreshEvent, changed);
		document.addEventListener('visibilitychange', refresh);
		const interval = window.setInterval(refresh, ttl);
		return () => {
			active = false;
			window.removeEventListener(refreshEvent, changed);
			document.removeEventListener('visibilitychange', refresh);
			window.clearInterval(interval);
		};
	}, [expectedScope, id, identity]);
	return expectedScope && result?.identity === identity
		? result.items.find((item) => item.category === category)
		: undefined;
}
