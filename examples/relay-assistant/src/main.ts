// SPDX-License-Identifier: AGPL-3.0-or-later

import {Assistant} from './Assistant.ts';
import {RelayClient, secureEndpoint} from './RelayClient.ts';

async function main() {
	const api = process.env.RELAY_API_URL ?? '';
	const media = process.env.RELAY_MEDIA_URL ?? '';
	const guildIds = (process.env.RELAY_GUILD_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	if (!guildIds.length || guildIds.some((id) => !/^\d{1,20}$/.test(id))) throw new Error('Configure RELAY_GUILD_IDS.');
	secureEndpoint(media);
	const client = new RelayClient(api, process.env.RELAY_BOT_TOKEN ?? '');
	client.on('warning', (message: string) => console.warn(message));
	client.on('READY', () => console.info('Relay Assistant connected.'));
	for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => client.stop());
	await new Assistant(client, media, guildIds).setup();
	await client.start();
}
main().catch(() => {
	console.error('Relay Assistant stopped. Check configuration, API connectivity and bot permissions.');
	process.exitCode = 1;
});
