// SPDX-License-Identifier: AGPL-3.0-or-later
import {createChannelID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {viewerFromCtx} from '@app/api/experiment/ChannelThreadsGate';
import {Logger} from '@app/api/Logger';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {Permissions} from '@relay/constants/src/ChannelConstants';
import {
	AvatarIdSchema,
	MovementSchema,
	RoomConfigSchema,
	RoomJoinSchema,
} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import type {Context} from 'hono';
import {z} from 'zod';
import {RoomSession} from './RoomSession';
import {getRoomStore, RoomError} from './RoomStore';

export function rooms3dEnabled() {
	return process.env.ORVIX_3D_ROOMS_ENABLED === 'true' && Config.database.backend === 'postgres';
}
const controls = RateLimitMiddleware({bucket: 'rooms3d:controls', config: {limit: 60, windowMs: 60_000}});
const movement = RateLimitMiddleware({bucket: 'rooms3d:movement', config: {limit: 900, windowMs: 60_000}});
async function access(ctx: Context<HonoEnv>, manage = false) {
	if (!rooms3dEnabled()) throw new RoomError('ROOMS_3D_DISABLED', 403);
	const id = ctx.req.param('channel_id');
	if (!id || !/^[0-9]{1,20}$/u.test(id)) throw new RoomError('INVALID_CHANNEL', 400);
	const user = ctx.get('user');
	if (user.isBot || user.isSystem) throw new RoomError('ROOM_ACCESS_DENIED', 403);
	const channelId = createChannelID(BigInt(id));
	const auth = await ctx
		.get('channelService')
		.channelData.auth.getChannelAuthenticated({userId: user.id, channelId, viewer: viewerFromCtx(ctx)});
	// DM calls inherit recipient access. Guild rooms inherit existing CONNECT/MANAGE_CHANNELS.
	if (auth.channel.guildId) await auth.checkPermission(manage ? Permissions.MANAGE_CHANNELS : Permissions.CONNECT);
	else if (manage && auth.channel.ownerId !== user.id) throw new RoomError('ROOM_ACCESS_DENIED', 403);
	const store = await getRoomStore(ctx.get('cacheService'));
	return {store, channelId, user, auth};
}
async function response(ctx: Context<HonoEnv>, fn: () => Promise<unknown>) {
	ctx.header('Cache-Control', 'private, no-store');
	try {
		return ctx.json(await fn());
	} catch (error) {
		if (error instanceof RoomError) return ctx.json({code: error.code, message: error.code}, error.status);
		if (error instanceof z.ZodError || error instanceof SyntaxError)
			return ctx.json({code: 'INVALID_ROOM_REQUEST'}, 400);
		throw error;
	}
}
async function roomJson(ctx: Context<HonoEnv>): Promise<unknown> {
	const text = await ctx.req.text();
	if (Buffer.byteLength(text) > 1024) throw new RoomError('ROOM_PACKET_TOO_LARGE', 400);
	return JSON.parse(text);
}
export function Rooms3dController(app: HonoApp) {
	app.get('/rooms3d/capabilities', LoginRequired, DefaultUserOnly, controls, (ctx) => {
		ctx.header('Cache-Control', 'private, no-store');
		return ctx.json({enabled: rooms3dEnabled()});
	});
	app.get('/channels/:channel_id/room3d', LoginRequired, DefaultUserOnly, controls, (ctx) =>
		response(ctx, async () => {
			const {store, channelId, auth} = await access(ctx);
			return {
				config: await store.config(String(channelId)),
				avatarId: await store.avatar(String(ctx.get('user').id)),
				canManage: auth.channel.guildId
					? await auth.hasPermission(Permissions.MANAGE_CHANNELS)
					: auth.channel.ownerId === ctx.get('user').id,
			};
		}),
	);
	app.put('/channels/:channel_id/room3d', LoginRequired, DefaultUserOnly, controls, (ctx) =>
		response(ctx, async () => {
			const {store, channelId, user} = await access(ctx, true);
			const config = RoomConfigSchema.parse(await roomJson(ctx));
			await store.configure(String(channelId), String(user.id), config);
			return {config};
		}),
	);
	app.put('/channels/:channel_id/room3d/avatar', LoginRequired, DefaultUserOnly, controls, (ctx) =>
		response(ctx, async () => {
			const {store, user} = await access(ctx);
			const {avatarId} = z
				.object({avatarId: AvatarIdSchema})
				.strict()
				.parse(await roomJson(ctx));
			await store.saveAvatar(String(user.id), avatarId);
			return {avatarId};
		}),
	);
	for (const operation of ['join', 'move', 'leave'] as const) {
		app.post(
			`/channels/:channel_id/room3d/${operation}`,
			LoginRequired,
			DefaultUserOnly,
			operation === 'move' ? movement : controls,
			(ctx) =>
				response(ctx, async () => {
					const {store, channelId, user, auth} = await access(ctx);
					const body = await roomJson(ctx);
					const input = operation === 'move' ? MovementSchema.parse(body) : null;
					const states = await ctx
						.get('gatewayService')
						.getVoiceStatesForChannel({guildId: auth.channel.guildId ?? undefined, channelId});
					const connectionId =
						operation === 'join' ? RoomJoinSchema.parse(body).connectionId : (input?.connectionId ?? '');
					// Movement body cannot spoof user/channel identity. Join must name a connection owned by this user.
					const members = new Set(states.voiceStates.map((s) => `${s.userId}:${s.connectionId}`));
					const session = new RoomSession(store, ctx.get('cacheService'), Date.now, async (snapshot, users) => {
						const results = await Promise.allSettled(
							users.map((id) =>
								ctx.get('gatewayService').dispatchPresence({
									userId: createUserID(BigInt(id)),
									event: 'ROOM_3D_UPDATE',
									data: {channel_id: String(channelId), snapshot},
								}),
							),
						);
						if (results.some((r) => r.status === 'rejected'))
							Logger.debug('3D room gateway delivery unavailable; HTTP snapshots remain available');
					});
					let command: Parameters<RoomSession['exchange']>[4];
					if (operation === 'join') command = {type: 'join', avatarId: await store.avatar(String(user.id))};
					else if (operation === 'move' && input) command = {type: 'move', input};
					else command = {type: 'leave', sessionId: z.object({sessionId: z.uuid()}).strict().parse(body).sessionId};
					return session.exchange(
						String(channelId),
						{userId: String(user.id), connectionId},
						members,
						() => store.config(String(channelId)),
						command,
					);
				}),
		);
	}
}
