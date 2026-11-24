// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MessageData} from './RelayClient.ts';

export interface RelayMessage {
	id: string;
	guild_id?: string;
	channel_id: string;
	content?: string | null;
	webhook_id?: string | null;
	author: {id: string; username: string; bot?: boolean};
}
export interface AssistantClient {
	request<T>(method: string, path: string, body?: unknown): Promise<T>;
	send(channelId: string, data: MessageData): Promise<unknown>;
	on(event: string, listener: (data: RelayMessage) => void): unknown;
	emit(event: string, message: string): unknown;
}
export const commands = [
	{name: 'ping', description: 'Relay API yanıt süresini gösterir.'},
	{name: 'help', description: 'Komutları listeler.'},
	{name: 'avatar', description: 'Avatarını gösterir. Kullanım: /avatar veya /avatar @kullanıcı'},
	{name: 'serverinfo', description: 'Bu sunucunun bilgilerini gösterir.'},
] as const;

export class Assistant {
	#client: AssistantClient;
	#media: string;
	#guildIds: Set<string>;
	#botId = '';
	#seen = new Set<string>();
	#queue: Promise<void> = Promise.resolve();
	#pending = 0;
	constructor(client: AssistantClient, mediaUrl: string, guildIds: string[]) {
		this.#client = client;
		this.#media = mediaUrl.replace(/\/$/, '');
		this.#guildIds = new Set(guildIds);
	}
	async setup(): Promise<void> {
		const me = await this.#client.request<{id: string; bot?: boolean}>('GET', '/users/@me');
		if (!me.bot) throw new Error('Relay Assistant requires a bot account token.');
		this.#botId = me.id;
		this.#client.on('MESSAGE_CREATE', (message) => {
			// Bound work and serialize replies without blocking Gateway heartbeats.
			if (this.#pending >= 20) return;
			this.#pending++;
			this.#queue = this.#queue
				.then(() => this.handle(message))
				.catch(() => {
					this.#client.emit('warning', 'Komut tamamlanamadı. Bot izinlerini ve API bağlantısını kontrol edin.');
				})
				.finally(() => {
					this.#pending--;
				});
		});
	}
	async handle(message: RelayMessage): Promise<void> {
		if (
			!message.guild_id ||
			!this.#guildIds.has(message.guild_id) ||
			message.author.bot ||
			message.author.id === this.#botId ||
			message.webhook_id ||
			this.#seen.has(message.id)
		)
			return;
		const match = /^\/(ping|help|avatar|serverinfo)(?:\s+(.*))?$/s.exec(message.content?.trim() ?? '');
		if (!match) return;
		this.#seen.add(message.id);
		if (this.#seen.size > 1000) this.#seen.delete(this.#seen.values().next().value!);
		const [, name, argument] = match;
		const reply = (data: MessageData) => this.#client.send(message.channel_id, data);
		if (name !== 'avatar' && argument) {
			await reply({content: `Kullanım: /${name}`});
			return;
		}
		switch (name) {
			case 'ping': {
				const started = Date.now();
				await this.#client.request('GET', '/users/@me');
				await reply({content: `Pong! API yanıt süresi: ${Date.now() - started} ms.`});
				break;
			}
			case 'help':
				await reply({
					embeds: [
						{
							title: 'Relay Assistant',
							description: commands.map((item) => `/${item.name} — ${item.description}`).join('\n'),
							color: 0x5865f2,
						},
					],
				});
				break;
			case 'avatar': {
				const userId = argument ? /^(?:<@!?(\d{1,20})>|(\d{1,20}))$/.exec(argument.trim()) : null;
				if (argument && !userId) {
					await reply({content: 'Kullanım: /avatar veya /avatar @kullanıcı'});
					return;
				}
				const user = await this.#client.request<{id: string; username: string; avatar?: string | null}>(
					'GET',
					`/users/${userId?.[1] ?? userId?.[2] ?? message.author.id}`,
				);
				// Relay's client strips a_ for a still WebP preview of animated avatars.
				const hash = user.avatar?.replace(/^a_/, '');
				await reply(
					hash
						? {
								embeds: [
									{
										title: `${user.username} avatar`,
										image: {url: `${this.#media}/avatars/${user.id}/${encodeURIComponent(hash)}.webp?size=512`},
									},
								],
							}
						: {content: `${user.username} özel avatar kullanmıyor.`},
				);
				break;
			}
			case 'serverinfo': {
				const guild = await this.#client.request<{name: string; id: string; member_count?: number}>(
					'GET',
					`/guilds/${message.guild_id}`,
				);
				await reply({
					embeds: [
						{
							title: guild.name,
							description: `ID: ${guild.id}${guild.member_count === undefined ? '' : `\nÜye sayısı: ${guild.member_count}`}`,
							color: 0x5865f2,
						},
					],
				});
				break;
			}
		}
	}
}
