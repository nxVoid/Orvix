// SPDX-License-Identifier: AGPL-3.0-or-later

const PINGGY_API_HEADERS: Readonly<Record<string, string>> = Object.freeze({'X-Pinggy-No-Screen': '1'});
const NO_TUNNEL_HEADERS: Readonly<Record<string, string>> = Object.freeze({});

/** Pinggy's browser screening also intercepts cookie-free discovery/API requests. */
export function publicTunnelRequestHeaders(endpoint: string): Readonly<Record<string, string>> {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return NO_TUNNEL_HEADERS;
	}
	if (url.protocol !== 'https:' || url.username || url.password || url.port) {
		return NO_TUNNEL_HEADERS;
	}
	return url.hostname.endsWith('.run.pinggy-free.link') || url.hostname.endsWith('.free.pinggy.net')
		? PINGGY_API_HEADERS
		: NO_TUNNEL_HEADERS;
}
