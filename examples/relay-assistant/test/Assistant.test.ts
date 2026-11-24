// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import {Assistant, type RelayMessage} from '../src/Assistant.ts';
import {RelayClient, secureEndpoint, type MessageData} from '../src/RelayClient.ts';

class Client extends EventEmitter {
	calls: Array<{method: string; path: string}> = [];
	sent: Array<{channelId: string; data: MessageData}> = [];
	async request<T>(method: string, path: string): Promise<T> {
		this.calls.push({method, path});
		if (path === '/users/@me') return {id: '99', bot: true} as T;
		if (path.startsWith('/users/')) return {id: path.split('/').at(-1), username: 'Ada', avatar: 'a_abcdef'} as T;
		if (path === '/guilds/1') return {id: '1', name: 'Relay Test', member_count: 12} as T;
		throw new Error('Unexpected endpoint');
	}
	async send(channelId: string, data: MessageData) {
		this.sent.push({channelId, data});
	}
}
const message = (content: string, id = '10'): RelayMessage => ({
	id,
	channel_id: '2',
	guild_id: '1',
	content,
	author: {id: '3', username: 'Ada'},
});

test('four commands use only existing REST endpoints and MESSAGE_CREATE', async () => {
	const client = new Client();
	const assistant = new Assistant(client, 'https://relay.example/media', ['1']);
	await assistant.setup();
	assert.equal(client.listenerCount('MESSAGE_CREATE'), 1);
	assert.equal(client.listenerCount('INTERACTION_CREATE'), 0);
	await assistant.handle(message('/ping', '10'));
	await assistant.handle(message('/help', '11'));
	await assistant.handle(message('/avatar <@4>', '12'));
	await assistant.handle(message('/serverinfo', '13'));
	assert.equal(client.sent.length, 4);
	assert.match(client.sent[0].data.content!, /^Pong!/);
	assert.match(client.sent[1].data.embeds![0].description!, /\/serverinfo/);
	assert.equal(client.sent[2].data.embeds![0].image!.url, 'https://relay.example/media/avatars/4/abcdef.webp?size=512');
	assert.match(client.sent[3].data.embeds![0].description!, /12/);
	assert.ok(client.calls.every((call) => call.method === 'GET'));
});

test('ignores DMs, unconfigured guilds, bots, webhooks and replayed messages', async () => {
	const client = new Client();
	const assistant = new Assistant(client, 'https://relay.example/media', ['1']);
	await assistant.setup();
	await assistant.handle({...message('/ping'), guild_id: undefined});
	await assistant.handle({...message('/ping'), guild_id: '8'});
	await assistant.handle({...message('/ping'), author: {id: '4', username: 'bot', bot: true}});
	await assistant.handle({...message('/ping'), webhook_id: '5'});
	await assistant.handle(message('/ping'));
	await assistant.handle(message('/ping'));
	assert.equal(client.sent.length, 1);
});

test('avatar defaults to the author and rejects malformed arguments without API calls', async () => {
	const client = new Client();
	const assistant = new Assistant(client, 'https://relay.example/media', ['1']);
	await assistant.setup();
	await assistant.handle(message('/avatar', '10'));
	assert.equal(client.calls.at(-1)?.path, '/users/3');
	const count = client.calls.length;
	await assistant.handle(message('/avatar ../../token', '11'));
	assert.equal(client.calls.length, count);
	assert.match(client.sent.at(-1)!.data.content!, /Kullanım/);
});

test('rejects unsafe endpoints and never exposes API error bodies or bot credentials', async () => {
	assert.throws(() => secureEndpoint('http://public.example/api'));
	assert.throws(() => secureEndpoint('https://user:secret@relay.example/api'));
	assert.equal(secureEndpoint('http://127.0.0.1:8088/api/v1').protocol, 'http:');
	const originalFetch = globalThis.fetch;
	const token = '123.secret';
	globalThis.fetch = async (_url, init) => {
		assert.equal(new Headers(init?.headers).get('authorization'), `Bot ${token}`);
		assert.equal(init?.redirect, 'error');
		return new Response(JSON.stringify({message: `secret ${token}`}), {status: 403});
	};
	try {
		await assert.rejects(
			new RelayClient('https://relay.example/api', token).request('GET', '/users/@me'),
			(error: Error) => error.message === 'Relay API request failed (403).' && !error.message.includes(token),
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('outbound messages disable mentions and do not require interactions', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		assert.equal(String(url), 'https://relay.example/api/v1/channels/2/messages');
		assert.deepEqual(JSON.parse(init?.body as string).allowed_mentions, {parse: []});
		return new Response('{}');
	};
	try {
		await new RelayClient('https://relay.example/api/v1', '123.secret').send('2', {content: '@everyone test'});
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('Gateway HELLO identifies with Relay properties, dispatches messages and cleans up on stop', async () => {
	const originalSocket = globalThis.WebSocket;
	const originalFetch = globalThis.fetch;
	const sent: Array<{op: number; d: Record<string, unknown>}> = [];
	let socket: FakeSocket;
	class FakeSocket extends EventTarget {
		static OPEN = 1;
		readyState = 1;
		constructor(_url: string | URL) {
			super(); socket = this;
			queueMicrotask(() => this.payload({op: 10, d: {heartbeat_interval: 20}}));
		}
		payload(data: unknown) { this.dispatchEvent(Object.assign(new Event('message'), {data: JSON.stringify(data)})); }
		send(data: string) {
			const payload = JSON.parse(data);
			sent.push(payload);
			if (payload.op === 2) queueMicrotask(() => {
				this.payload({op: 0, t: 'READY', s: 1, d: {session_id: 'session'}});
				this.payload({op: 0, t: 'MESSAGE_CREATE', s: 2, d: message('/ping')});
			});
			if (payload.op === 1) queueMicrotask(() => this.payload({op: 11, d: null}));
		}
		close(code = 1000) {
			this.readyState = 3;
			this.dispatchEvent(Object.assign(new Event('close'), {code}));
		}
	}
	globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
	globalThis.fetch = async () => new Response(JSON.stringify({url: 'wss://relay.example/gateway'}));
	try {
		const client = new RelayClient('https://relay.example/api', '123.secret');
		let received = 0;
		client.on('MESSAGE_CREATE', () => { received++; });
		client.on('READY', () => {
			setTimeout(() => { socket.payload({op: 0, t: 'MESSAGE_CREATE', s: 3, d: message('/ping')}); client.stop(); }, 45);
		});
		await client.start();
		assert.equal(received, 1);
		assert.equal(sent[0].op, 2);
		assert.equal(sent[0].d.token, '123.secret');
		assert.deepEqual(sent[0].d.properties, {os: process.platform, browser: 'Relay Assistant', device: 'Relay Assistant'});
		assert.ok(sent.some((payload) => payload.op === 1));
	} finally { globalThis.WebSocket = originalSocket; globalThis.fetch = originalFetch; }
});
