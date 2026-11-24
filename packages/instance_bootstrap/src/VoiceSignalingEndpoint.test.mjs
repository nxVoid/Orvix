// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveVoiceSignalingEndpoint} from './VoiceSignalingEndpoint.ts';

const source = 'ws://192.168.1.28:18088/livekit';
const publicApi = 'http://192.168.1.28:18088/api';

test('HTTPS tunnel uses WSS for its own LiveKit proxy', () => {
	assert.equal(
		resolveVoiceSignalingEndpoint(source, publicApi, 'https://demo.free.pinggy.net/api'),
		'wss://demo.free.pinggy.net/livekit',
	);
});
test('localhost keeps a usable local voice route', () => {
	assert.equal(
		resolveVoiceSignalingEndpoint(source, publicApi, 'http://localhost:8088/api'),
		'ws://localhost:8088/livekit',
	);
});
test('a nonstandard tunnel port and voice query are preserved', () => {
	assert.equal(
		resolveVoiceSignalingEndpoint(`${source}?region=local`, publicApi, 'https://relay.example:8443/api'),
		'wss://relay.example:8443/livekit?region=local',
	);
});
for (const endpoint of [
	'wss://voice.example/rtc',
	'wss://voice.example/livekit',
	'ws://192.168.1.28:18088/custom-livekit',
	'not a URL',
]) {
	test(`keeps a separate or custom voice endpoint: ${endpoint}`, () => {
		assert.equal(resolveVoiceSignalingEndpoint(endpoint, publicApi, 'https://demo.free.pinggy.net/api'), endpoint);
	});
}
test('desktop local transport does not replace the actual voice server', () => {
	assert.equal(resolveVoiceSignalingEndpoint(source, publicApi, 'orvix-app://app/api/instance'), source);
});
