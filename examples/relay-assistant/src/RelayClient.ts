// SPDX-License-Identifier: AGPL-3.0-or-later

import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

export interface Interaction {
	id: string;
	application_id: string;
	guild_id: string;
	channel_id: string;
	user: {id: string; username: string; avatar?: string | null};
	member_permissions: string;
	data: {name: string; options: Record<string, string>};
}
export interface MessageData {
	content?: string;
	embeds?: Array<{
		title?: string;
		description?: string;
		color?: number;
		image?: {url: string};
		thumbnail?: {url: string};
	}>;
}
export function secureEndpoint(value: string, websocket = false): URL {
	const url = new URL(value);
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		url.username ||
		url.password ||
		url.hash ||
		url.search ||
		!(
			(websocket ? ['wss:'] : ['https:']).includes(url.protocol) ||
			(local && (websocket ? url.protocol === 'ws:' : url.protocol === 'http:'))
		)
	) {
		throw new Error('Use HTTPS/WSS, or loopback HTTP/WS, without URL credentials or query strings.');
	}
	return url;
}
export class RelayApiError extends Error {
	status: number;
	constructor(status: number) {
		super(`Relay API request failed (${status}).`);
		this.status = status;
	}
}
export class RelayClient extends EventEmitter {
	#token: string;
	#base: string;
	#socket: WebSocket | null = null;
	#stopped = false;
	#session: string | null = null;
	#sequence: number | null = null;
	#seen = new Set<string>();
	constructor(apiUrl: string, token: string) {
		super();
		this.#base = secureEndpoint(apiUrl).href.replace(/\/$/, '');
		if (!/^\d+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('RELAY_BOT_TOKEN is missing or malformed.');
		this.#token = token;
	}
	async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) throw new Error('Invalid API path.');
		for (let attempt = 0; attempt < 4; attempt++) {
			let response: Response;
			try {
				response = await fetch(`${this.#base}${path}`, {
					method,
					headers: {Authorization: `Bot ${this.#token}`, 'Content-Type': 'application/json'},
					body: body === undefined ? undefined : JSON.stringify(body),
					redirect: 'error',
					signal: AbortSignal.timeout(15000),
				});
			} catch {
				throw new Error('Relay API is unreachable.');
			}
			if (response.status === 429 && attempt < 3) {
				const data = (await response.json().catch(() => ({}))) as {retry_after?: number};
				const seconds = Number(response.headers.get('retry-after') ?? data.retry_after ?? 1);
				await delay(Math.min(30000, Math.max(250, Number.isFinite(seconds) ? seconds * 1000 : 1000)));
				continue;
			}
			if (!response.ok) throw new RelayApiError(response.status);
			if (response.status === 204) return undefined as T;
			return (await response.json()) as T;
		}
		throw new RelayApiError(429);
	}
	send(channelId: string, data: MessageData) {
		return this.request('POST', `/channels/${channelId}/messages`, {...data, allowed_mentions: {parse: []}});
	}
	respond(interaction: Interaction, data: MessageData) {
		return this.request('POST', `/interactions/${interaction.id}/callback`, data);
	}
	stop() {
		this.#stopped = true;
		this.#socket?.close(1000);
	}
	async start(): Promise<void> {
		let failures = 0;
		while (!this.#stopped) {
			try {
				const {url} = await this.request<{url: string}>('GET', '/gateway/bot');
				const gateway = secureEndpoint(url, true);
				gateway.searchParams.set('v', '1');
				gateway.searchParams.set('encoding', 'json');
				await this.#connect(gateway.href);
				failures = 0;
			} catch (error) {
				if (this.#stopped || (error instanceof RelayApiError && [401, 403].includes(error.status))) throw error;
				this.emit('warning', 'Gateway disconnected; reconnecting.');
			}
			if (!this.#stopped) await delay(Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) + Math.random() * 500);
		}
	}
	#connect(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(url);
			this.#socket = socket;
			let heartbeat: ReturnType<typeof setInterval> | undefined;
			let awaitingAck = false;
			let authenticated = false;
			const helloTimeout = setTimeout(() => socket.close(4000), 30000);
			const send = (op: number, d: unknown) => {
				if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({op, d}));
			};
			const beat = () => {
				if (awaitingAck) {
					socket.close(4000);
					return;
				}
				awaitingAck = true;
				send(1, this.#sequence);
			};
			socket.addEventListener('message', (event) => {
				try {
					if (typeof event.data !== 'string') {
						socket.close(4002);
						return;
					}
					const payload = JSON.parse(event.data) as {op: number; d: any; t?: string; s?: number};
					if (typeof payload.s === 'number') this.#sequence = payload.s;
					switch (payload.op) {
						case 10: {
							clearTimeout(helloTimeout);
							if (authenticated) {
								socket.close(4005);
								return;
							}
							authenticated = true;
							const interval = payload.d?.heartbeat_interval;
							if (!Number.isFinite(interval) || interval < 10) {
								socket.close(4002);
								return;
							}
							heartbeat = setInterval(beat, interval);
							if (this.#session && this.#sequence !== null)
								send(6, {token: this.#token, session_id: this.#session, seq: this.#sequence});
							else
								send(2, {
									token: this.#token,
									properties: {os: process.platform, browser: 'Relay Assistant', device: 'Relay Assistant'},
									ignored_events: ['TYPING_START', 'PRESENCE_UPDATE'],
								});
							break;
						}
						case 11:
							awaitingAck = false;
							break;
						case 1:
							send(1, this.#sequence);
							break;
						case 7:
							socket.close(4000);
							break;
						case 9:
							this.#session = null;
							this.#sequence = null;
							socket.close(4000);
							break;
						case 0: {
							if (payload.t === 'READY') this.#session = payload.d.session_id;
							if (payload.t === 'INTERACTION_CREATE' || payload.t === 'MESSAGE_CREATE') {
								if (this.#seen.has(payload.d.id)) break;
								this.#seen.add(payload.d.id);
								if (this.#seen.size > 1000) this.#seen.delete(this.#seen.values().next().value!);
							}
							if (payload.t) this.emit(payload.t, payload.d);
							break;
						}
					}
				} catch {
					this.emit('warning', 'Invalid Gateway payload or event handler failure.');
				}
			});
			socket.addEventListener('error', () => socket.close());
			socket.addEventListener('close', (event) => {
				clearTimeout(helloTimeout);
				clearInterval(heartbeat);
				if ([4004, 4010, 4011, 4012].includes(event.code)) {
					this.#stopped = true;
					reject(new Error(`Gateway authentication/configuration rejected (${event.code}).`));
				} else {
					if ([4007, 4009].includes(event.code)) {
						this.#session = null;
						this.#sequence = null;
					}
					resolve();
				}
			});
		});
	}
}
