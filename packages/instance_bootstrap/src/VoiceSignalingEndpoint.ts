// SPDX-License-Identifier: AGPL-3.0-or-later

/** Follow an instance's conventional voice proxy through its active API transport. */
export function resolveVoiceSignalingEndpoint(endpoint: string, publicApi: string, transportApi: string): string {
	let voice: URL;
	let advertised: URL;
	let transport: URL;
	try {
		voice = new URL(endpoint);
		advertised = new URL(publicApi);
		transport = new URL(transportApi);
	} catch {
		return endpoint;
	}
	if (
		!['ws:', 'wss:'].includes(voice.protocol) ||
		!['http:', 'https:'].includes(transport.protocol) ||
		voice.host !== advertised.host ||
		voice.pathname !== '/livekit' ||
		voice.username ||
		voice.password ||
		transport.username ||
		transport.password
	) {
		return endpoint;
	}
	voice.protocol = transport.protocol === 'https:' ? 'wss:' : 'ws:';
	voice.hostname = transport.hostname;
	voice.port = transport.port;
	return voice.toString();
}
