// SPDX-License-Identifier: AGPL-3.0-or-later

import {authorizeBot, createTestBotAccount} from '@app/api/bot/tests/BotTestUtils';
import {createGuild} from '@app/api/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {Permissions} from '@relay/constants/src/ChannelConstants';
import type {MessageResponse} from '@relay/schema/src/domains/message/MessageResponseSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Relay Assistant existing API contracts', () => {
	let harness: ApiTestHarness;
	beforeEach(async () => { harness = await createApiTestHarness(); });
	afterEach(async () => { await harness?.shutdown(); });

	it('uses the existing OAuth2 bot invite, gateway discovery, user/guild reads and message send', async () => {
		const bot = await createTestBotAccount(harness);
		const guild = await createGuild(harness, bot.ownerToken, 'Assistant test');
		const permissions = Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES | Permissions.EMBED_LINKS | Permissions.READ_MESSAGE_HISTORY;
		await authorizeBot(harness, bot.ownerToken, bot.appId, ['bot'], guild.id, permissions.toString());
		const auth = `Bot ${bot.botToken}`;
		const gateway = await createBuilder<{url: string}>(harness, auth).get('/gateway/bot').execute();
		expect(gateway.url).toBeTruthy();
		const me = await createBuilder<{id: string; bot: boolean}>(harness, auth).get('/users/@me').execute();
		expect(me).toMatchObject({id: bot.botUserId, bot: true});
		await createBuilder(harness, auth).get(`/users/${bot.ownerUserId}`).execute();
		await createBuilder(harness, auth).get(`/guilds/${guild.id}`).execute();
		const response = await createBuilder<MessageResponse>(harness, auth)
			.post(`/channels/${guild.system_channel_id}/messages`)
			.body({content: 'Pong!', allowed_mentions: {parse: []}, embeds: [{title: 'Relay Assistant', description: '/ping /help /avatar /serverinfo'}]})
			.execute();
		expect(response.author.id).toBe(bot.botUserId);
		expect(response.embeds?.[0]?.title).toBe('Relay Assistant');
	});

	it('rejects a syntactically valid but invalid bot secret during gateway discovery', async () => {
		const bot = await createTestBotAccount(harness);
		await createBuilderWithoutAuth(harness).get('/gateway/bot')
			.header('Authorization', `Bot ${bot.appId}.invalid-secret`).expect(401).execute();
	});
});
