// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {getPngDataUrl} from '@app/api/emoji/tests/EmojiTestUtils';
import {getConfig} from '@app/api/Config';
import {acceptInvite, createGuild} from '@app/api/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {createChannelInvite, createWebhook} from '@app/api/webhook/tests/WebhookTestUtils';
import type {WebhookResponse} from '@relay/schema/src/domains/webhook/WebhookSchemas';
import type {MessageResponse} from '@relay/schema/src/domains/message/MessageResponseSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Webhook settings management', () => {
	let harness: ApiTestHarness;
	beforeEach(async () => {
		harness = await createApiTestHarness();
	});
	afterEach(async () => {
		await harness?.shutdown();
	});

	it('rotates the token, preserves metadata and rejects every old credential operation', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook rotation');
		const webhook = await createWebhook(harness, guild.system_channel_id!, owner.token, 'Original');
		const rotated = await createBuilder<WebhookResponse>(harness, owner.token)
			.post(`/webhooks/${webhook.id}/token/rotate`)
			.execute();
		expect(rotated.token).toBeTruthy();
		expect(rotated.token).not.toBe(webhook.token);
		expect(rotated).toMatchObject({id: webhook.id, name: webhook.name, channel_id: webhook.channel_id});
		for (const method of ['get', 'patch', 'delete', 'post'] as const) {
			const request = createBuilderWithoutAuth(harness)[method](`/webhooks/${webhook.id}/${webhook.token}`);
			if (method === 'patch' || method === 'post') request.body(method === 'patch' ? {name: 'old'} : {content: 'old'});
			await request.expect(404).execute();
		}
		await createBuilderWithoutAuth(harness).get(`/webhooks/${webhook.id}/${rotated.token}`).execute();
		const listed = await createBuilder<Array<WebhookResponse>>(harness, owner.token)
			.get(`/channels/${webhook.channel_id}/webhooks`)
			.execute();
		expect(listed).toHaveLength(1);
		expect(listed[0]?.token).toBe(rotated.token);
	});

	it('supports the existing panel create, rename, avatar, copy URL and delete flow', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook panel');
		const webhook = await createBuilder<WebhookResponse>(harness, owner.token)
			.post(`/channels/${guild.system_channel_id}/webhooks`)
			.body({name: 'Panel test', avatar: getPngDataUrl()})
			.execute();
		expect(webhook.avatar).toBeTruthy();
		const renamed = await createBuilder<WebhookResponse>(harness, owner.token)
			.patch(`/webhooks/${webhook.id}`)
			.body({name: 'Renamed'})
			.execute();
		expect(renamed.avatar).toBe(webhook.avatar);
		expect(renamed.name).toBe('Renamed');
		const cleared = await createBuilder<WebhookResponse>(harness, owner.token)
			.patch(`/webhooks/${webhook.id}`)
			.body({avatar: null})
			.execute();
		expect(cleared.avatar).toBeNull();
		// The panel copies this existing token URL. Verify its use without a user session.
		const url = `/webhooks/${webhook.id}/${webhook.token}`;
		await createBuilderWithoutAuth(harness).post(url).body({content: 'URL copy smoke test'}).expect(204).execute();
		await createBuilder(harness, owner.token).delete(`/webhooks/${webhook.id}`).expect(204).execute();
		await createBuilderWithoutAuth(harness).get(url).expect(404).execute();
	});

	it('denies rotation and test sends to a member without Manage Webhooks', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook access');
		const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
		await acceptInvite(harness, member.token, invite.code);
		const webhook = await createWebhook(harness, guild.system_channel_id!, owner.token, 'Restricted');
		for (const suffix of ['token/rotate', 'test-message']) {
			await createBuilder(harness, member.token)
				.post(`/webhooks/${webhook.id}/${suffix}`)
				.body({content: 'Denied'})
				.expect(403)
				.execute();
			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${suffix}`)
				.body({content: 'Denied'})
				.expect(401)
				.execute();
		}
	});

	it('sends an embed from the app origin using session auth and disables mentions', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook composer');
		const webhook = await createWebhook(harness, guild.system_channel_id!, owner.token, 'Composer');
		const message = await createBuilder<MessageResponse>(harness, owner.token)
			.post(`/webhooks/${webhook.id}/test-message`)
			.header('origin', getConfig().endpoints.webAppOrigins[0]!)
			.body({
				content: '@everyone test',
				embeds: [
					{
						title: 'Preview',
						description: 'Description',
						color: 5793266,
						image: {url: 'https://example.com/banner.png'},
						thumbnail: {url: 'https://example.com/thumb.png'},
					},
				],
			})
			.execute();
		expect(message.webhook_id).toBe(webhook.id);
		expect(message.embeds?.[0]).toMatchObject({title: 'Preview', description: 'Description', color: 5793266});
		expect(message.mention_everyone).toBe(false);
		expect(message.embeds?.[0]?.image?.url).toContain('/banner.png');
		expect(message.embeds?.[0]?.thumbnail?.url).toContain('/thumb.png');
		await createBuilder(harness, owner.token)
			.post(`/webhooks/${webhook.id}/test-message`)
			.body({content: 'test', username: 'spoof'})
			.expect(400)
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/webhooks/${webhook.id}/test-message`)
			.body({})
			.expect(400)
			.execute();
	});
});
