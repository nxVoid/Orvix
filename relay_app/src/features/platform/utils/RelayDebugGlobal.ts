// SPDX-License-Identifier: AGPL-3.0-or-later

type RelayDebugObject = NonNullable<Window['__ORVIX_DEBUG__']>;

export function getRelayDebugObject(): RelayDebugObject | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const existing = window.__ORVIX_DEBUG__;
	if (existing === undefined || existing === null) {
		const created: RelayDebugObject = {};
		window.__ORVIX_DEBUG__ = created;
		return created;
	}
	if (typeof existing !== 'object' || Array.isArray(existing)) {
		return null;
	}
	return existing;
}
