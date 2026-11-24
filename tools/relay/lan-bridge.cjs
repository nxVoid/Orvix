// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict';

const net = require('node:net');
const dgram = require('node:dgram');
const {parseArgs} = require('node:util');

async function startLanBridge({host, tcpRoutes, udpRoute, idleMs = 120000, maxSessions = 256}) {
	const servers = [];
	const connections = new Set();
	const sessions = new Map();
	let udp;
	let timer;
	const close = async () => {
		clearInterval(timer);
		for (const socket of connections) socket.destroy();
		for (const session of sessions.values()) session.socket.close();
		sessions.clear();
		await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
		if (udp) await new Promise((resolve) => {
			try { udp.close(resolve); } catch { resolve(); }
		});
	};
	try {
		for (const route of tcpRoutes) {
			const server = net.createServer({allowHalfOpen: true}, (client) => {
				const upstream = net.connect({port: route.targetPort, host: route.targetHost ?? '127.0.0.1', allowHalfOpen: true});
				for (const socket of [client, upstream]) {
					connections.add(socket);
					socket.once('close', () => connections.delete(socket));
				}
				client.on('error', () => upstream.destroy());
				upstream.on('error', () => client.destroy());
				client.once('close', () => upstream.destroy());
				upstream.once('close', () => client.destroy());
				client.pipe(upstream);
				upstream.pipe(client);
			});
			await new Promise((resolve, reject) => {
				server.once('error', reject);
				server.listen(route.listenPort, host, resolve);
			});
			servers.push(server);
		}
		if (udpRoute) {
			const listener = dgram.createSocket('udp4');
			udp = listener;
			await new Promise((resolve, reject) => {
				listener.once('error', reject);
				listener.bind(udpRoute.listenPort, host, resolve);
			});
			listener.on('error', (error) => console.error('Relay UDP listener:', error.message));
			listener.on('message', (message, remote) => {
				const key = `${remote.address}:${remote.port}`;
				let session = sessions.get(key);
				if (!session) {
					if (sessions.size >= maxSessions) return;
					const socket = dgram.createSocket('udp4');
					session = {socket, touchedAt: Date.now()};
					sessions.set(key, session);
					socket.on('message', (reply, source) => {
						session.touchedAt = Date.now();
						listener.send(reply, remote.port, remote.address, () => {});
					});
					socket.on('error', (err) => {
						console.error('[LAN Bridge UDP Socket Error]', err.message);
						if (sessions.get(key) === session) sessions.delete(key);
						socket.close();
					});
				}
				session.touchedAt = Date.now();
				session.socket.send(message, udpRoute.targetPort, udpRoute.targetHost ?? '127.0.0.1', (err) => {
					if (err) console.error('[LAN Bridge UDP Send Error]', err.message);
				});
			});
			timer = setInterval(() => {
				for (const [key, session] of sessions) {
					if (Date.now() - session.touchedAt < idleMs) continue;
					sessions.delete(key);
					session.socket.close();
				}
			}, Math.min(30000, idleMs));
			timer.unref();
		}
		return {close, tcp: servers.map((server) => server.address()), udp: udp?.address()};
	} catch (error) {
		await close();
		throw error;
	}
}

if (require.main === module) {
	const {values} = parseArgs({options: {host: {type: 'string'}}});
	const host = values.host || '0.0.0.0';
	const tcpRoutes = [
		{listenPort: 18088, targetPort: 8088},
		{listenPort: 7881, targetPort: 17881},
	];
	startLanBridge({
		host,
		tcpRoutes,
		udpRoute: {listenPort: 7882, targetPort: 17882},
	}).then((bridge) => {
		console.log(`Relay LAN: http://${host}:18088; RTC TCP 7881 / UDP 7882`);
		for (const signal of ['SIGINT', 'SIGTERM']) {
			process.once(signal, () => bridge.close().then(() => process.exit(0)));
		}
	}).catch((error) => {
		console.error('Relay LAN bridge failed:', error.message);
		process.exitCode = 1;
	});
}

module.exports = {startLanBridge};
