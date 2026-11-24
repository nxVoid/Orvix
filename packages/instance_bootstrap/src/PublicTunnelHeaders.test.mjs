// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {publicTunnelRequestHeaders} from './PublicTunnelHeaders.ts';

for (const endpoint of [
	'https://bsobu-176-88-77-180.run.pinggy-free.link/api/.well-known/orvix',
	'https://puewd-176-88-77-180.free.pinggy.net/api/auth/login',
	'https://DEMO.RUN.PINGGY-FREE.LINK:443/api/users/@me',
]) {
	test(`adds the documented screening bypass to ${endpoint}`, () => {
		assert.deepEqual(publicTunnelRequestHeaders(endpoint), {'X-Pinggy-No-Screen': '1'});
	});
}

for (const endpoint of [
	'http://localhost:8088/api',
	'http://192.168.1.28:18088/api',
	'https://relay.example/api',
	'https://demo.free.pinggy.net.evil.example/api',
	'https://notfree.pinggy.net/api',
	'http://demo.run.pinggy-free.link/api',
	'https://user:password@demo.free.pinggy.net/api',
	'https://demo.free.pinggy.net:8443/api',
	'/api/.well-known/orvix',
	'not a URL',
]) {
	test(`does not add tunnel headers to ${endpoint}`, () => {
		assert.deepEqual(publicTunnelRequestHeaders(endpoint), {});
	});
}
