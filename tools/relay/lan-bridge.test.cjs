// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const dgram = require('node:dgram');
const {once} = require('node:events');
const {test} = require('node:test');
const {startLanBridge} = require('./lan-bridge.cjs');

test('TCP forwarding preserves binary data and WebSocket upgrade bytes', async (t) => {
	const upstream = net.createServer((socket) => socket.pipe(socket));
	upstream.listen(0, '127.0.0.1');
	await once(upstream, 'listening');
	const bridge = await startLanBridge({
		host: '127.0.0.2',
		tcpRoutes: [{listenPort: 0, targetPort: upstream.address().port}],
	});
	t.after(async () => { await bridge.close(); await new Promise((resolve) => upstream.close(resolve)); });
	const payload = Buffer.concat([Buffer.from('GET /gateway HTTP/1.1\r\nConnection: Upgrade\r\n\r\n'), Buffer.from([0, 255, 128, 1])]);
	const client = net.connect(bridge.tcp[0].port, '127.0.0.2');
	const chunks = [];
	let length = 0;
	const reply = await new Promise((resolve, reject) => {
		client.setTimeout(2000, () => reject(new Error('TCP bridge timed out')));
		client.on('error', reject);
		client.on('data', (chunk) => {
			chunks.push(chunk); length += chunk.length;
			if (length >= payload.length) { client.destroy(); resolve(Buffer.concat(chunks)); }
		});
		client.end(payload);
	});
	assert.deepEqual(reply, payload);
});

test('UDP forwarding keeps concurrent clients and their encrypted payloads separate', async (t) => {
	const upstream = dgram.createSocket('udp4');
	const sourcePorts = new Set();
	upstream.on('message', (message, remote) => {
		sourcePorts.add(remote.port);
		upstream.send(message, remote.port, remote.address);
	});
	upstream.bind(0, '127.0.0.1');
	await once(upstream, 'listening');
	const bridge = await startLanBridge({
		host: '127.0.0.2', tcpRoutes: [],
		udpRoute: {listenPort: 0, targetPort: upstream.address().port},
	});
	t.after(async () => { await bridge.close(); await new Promise((resolve) => upstream.close(resolve)); });
	const exchange = async (payload) => {
		const client = dgram.createSocket('udp4');
		try {
			const response = once(client, 'message', {signal: AbortSignal.timeout(2000)});
			client.send(payload, bridge.udp.port, '127.0.0.2');
			const [message] = await response;
			assert.deepEqual(message, payload);
		} finally { client.close(); }
	};
	await Promise.all([exchange(Buffer.from([1, 0, 255])), exchange(Buffer.from([2, 255, 0]))]);
	assert.equal(sourcePorts.size, 2);
});

test('a failed UDP bind rolls back previously opened TCP listeners', async () => {
	const occupied = dgram.createSocket('udp4');
	occupied.bind(0, '127.0.0.2');
	await once(occupied, 'listening');
	try {
		await assert.rejects(startLanBridge({
			host: '127.0.0.2', tcpRoutes: [{listenPort: 0, targetPort: 1}],
			udpRoute: {listenPort: occupied.address().port, targetPort: 1},
		}), {code: 'EADDRINUSE'});
	} finally { occupied.close(); }
});
