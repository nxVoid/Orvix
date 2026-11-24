// SPDX-License-Identifier: AGPL-3.0-or-later
import {Config} from '@app/api/Config';
import {setupTestGuildWithMembers} from '@app/api/channel/tests/ChannelTestUtils';
import {createChannel} from '@app/api/guild/tests/GuildTestUtils';
import {getGatewayService} from '@app/api/middleware/ServiceRegistry';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {DEFAULT_ROOM_CONFIG, type RoomSnapshot} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import * as Store from './RoomStore';

// Real authentication/channel permissions with isolated room storage. Real SQL locking is tested separately.
describe('enabled rooms inherit channel authorization', () => {
	let harness: ApiTestHarness;
	let backend: typeof Config.database.backend;
	let flag: string | undefined;
	const locks = new Map<string, Promise<unknown>>();
	beforeAll(async () => {
		harness = await createApiTestHarness();
		backend = Config.database.backend;
		flag = process.env.ORVIX_3D_ROOMS_ENABLED;
		Config.database.backend = 'postgres';
		process.env.ORVIX_3D_ROOMS_ENABLED = 'true';
		vi.spyOn(Store, 'getRoomStore').mockResolvedValue({
			config: async () => ({...DEFAULT_ROOM_CONFIG}),
			avatar: async () => 'violet',
			saveAvatar: async () => {},
			configure: async () => {},
			locked<T>(id: string, fn: (key: string) => Promise<T>) {
				const next = (locks.get(id) ?? Promise.resolve()).catch(() => {}).then(() => fn(`auth-test:${id}`));
				locks.set(id, next);
				return next;
			},
		} as unknown as Store.RoomStore);
	});
	afterAll(async () => {
		vi.restoreAllMocks();
		Config.database.backend = backend;
		if (flag === undefined) delete process.env.ORVIX_3D_ROOMS_ENABLED;
		else process.env.ORVIX_3D_ROOMS_ENABLED = flag;
		await harness?.shutdown();
	});
	it('denies ordinary members room management, requires an owned active voice connection, and publishes only room users', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const channel = await createChannel(harness, owner.token, guild.id, '3D test voice', 2);
		await createBuilder(harness, members[0].token)
			.put(`/channels/${channel.id}/room3d`)
			.body(DEFAULT_ROOM_CONFIG)
			.expect(403)
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/channels/${channel.id}/room3d/join`)
			.body({connectionId: 'not-connected'})
			.expect(403)
			.execute();
		const gateway = getGatewayService();
		vi.spyOn(gateway, 'getVoiceStatesForChannel').mockResolvedValue({
			voiceStates: [{userId: owner.userId, connectionId: 'owned-voice', channelId: channel.id}],
		});
		const dispatch = vi.spyOn(gateway, 'dispatchPresence').mockResolvedValue();
		const joined = await createBuilder<RoomSnapshot & {sessionId: string}>(harness, owner.token)
			.post(`/channels/${channel.id}/room3d/join`)
			.body({connectionId: 'owned-voice'})
			.expect(200)
			.execute();
		expect(joined.participants.map((p) => p.userId)).toEqual([owner.userId]);
		expect(joined.sessionId).toBeTruthy();
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(String(dispatch.mock.calls[0][0].userId)).toBe(owner.userId);
		expect(JSON.stringify(dispatch.mock.calls[0][0].data)).not.toContain(joined.sessionId);
		await createBuilder(harness, members[0].token)
			.post(`/channels/${channel.id}/room3d/join`)
			.body({connectionId: 'owned-voice'})
			.expect(403)
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/channels/${channel.id}/room3d/move`)
			.body({
				sessionId: joined.sessionId,
				connectionId: 'owned-voice',
				sequence: 1,
				x: 0,
				z: 0,
				rotationY: 0,
				run: false,
				userId: members[0].userId,
			})
			.expect(400)
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/channels/${channel.id}/room3d/join`)
			.body({connectionId: 'a'.repeat(1500)})
			.expect(400)
			.execute();
	});
});
