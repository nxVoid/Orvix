// SPDX-License-Identifier: AGPL-3.0-or-later
import {randomUUID} from 'node:crypto';
import type {ICacheService} from '@pkgs/cache/src/ICacheService';
import {moveAvatar} from '@relay/schema/src/domains/rooms3d/RoomGeometry';
import type {
	AvatarId,
	AvatarState,
	MovementInput,
	RoomConfig,
	RoomSnapshot,
} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {RoomError} from './RoomStore';

interface Session extends AvatarState {
	sessionId: string;
	updatedAt: number;
	movedAt: number;
}
interface RoomState {
	sessions: Array<Session>;
	generation: string;
	revision: number;
	lastBroadcast: number;
}
interface SessionStore {
	locked<T>(channelId: string, fn: (key: string) => Promise<T>): Promise<T>;
}
export interface RoomActor {
	userId: string;
	connectionId: string;
}
export class RoomSession {
	constructor(
		private readonly store: SessionStore,
		private readonly cache: ICacheService,
		private readonly clock = Date.now,
		private readonly notify?: (snapshot: RoomSnapshot, users: Array<string>) => Promise<void>,
	) {}
	async exchange(
		channelId: string,
		actor: RoomActor,
		members: ReadonlySet<string>,
		configuration: RoomConfig | (() => Promise<RoomConfig>),
		operation:
			| {type: 'join'; avatarId: AvatarId}
			| {type: 'move'; input: MovementInput}
			| {type: 'leave'; sessionId: string},
	) {
		const exchange = await this.store.locked(channelId, async (key) => {
			const config = typeof configuration === 'function' ? await configuration() : configuration;
			const now = this.clock();
			const state = (await this.cache.get<RoomState>(key)) ?? {
				sessions: [],
				generation: randomUUID(),
				revision: 0,
				lastBroadcast: 0,
			};
			let sessions = state.sessions.filter(
				(s) => now - s.updatedAt < 5000 && members.has(`${s.userId}:${s.connectionId}`),
			);
			const own = sessions.find((s) => s.userId === actor.userId);
			if (operation.type === 'leave') {
				sessions = sessions.filter((s) => s.userId !== actor.userId || s.sessionId !== operation.sessionId);
			} else if (!config.enabled) {
				throw new RoomError('ROOM_DISABLED', 403);
			} else if (!members.has(`${actor.userId}:${actor.connectionId}`)) {
				sessions = sessions.filter((s) => s.userId !== actor.userId);
				await this.cache.set(key, {...state, sessions}, 10);
				throw new RoomError('VOICE_MEMBERSHIP_REQUIRED', 403);
			} else if (operation.type === 'join') {
				if (!own && sessions.length >= config.maxParticipants) throw new RoomError('ROOM_FULL');
				sessions = sessions.filter((s) => s.userId !== actor.userId);
				const index = sessions.length;
				sessions.push({
					userId: actor.userId,
					connectionId: actor.connectionId,
					avatarId: operation.avatarId,
					sessionId: randomUUID(),
					position: {x: -8 + (index % 8) * 2, y: 0, z: 6.8 - Math.floor(index / 8)},
					rotationY: 0,
					animation: 'idle',
					sequence: 0,
					updatedAt: now,
					movedAt: now,
				});
			} else {
				if (!own) throw new RoomError('ROOM_SESSION_EXPIRED');
				if (own.sessionId !== operation.input.sessionId || own.connectionId !== actor.connectionId)
					throw new RoomError('ROOM_SESSION_REPLACED');
				const input = operation.input;
				if (input.sequence <= own.sequence) throw new RoomError('STALE_SEQUENCE');
				if (now - own.updatedAt < 60) throw new RoomError('MOVEMENT_RATE_LIMIT', 429);
				own.position = moveAvatar(own.position, input, (now - own.movedAt) / 1000, config.templateId);
				own.rotationY = input.rotationY;
				own.animation = 'idle';
				if (input.sit) own.animation = 'sit';
				else if (input.emote) own.animation = input.emote;
				else if (Math.hypot(input.x, input.z) > 0) own.animation = input.run ? 'run' : 'walk';
				own.sequence = input.sequence;
				own.updatedAt = now;
				own.movedAt = now;
			}
			const broadcast = operation.type !== 'move' || now - state.lastBroadcast >= 100;
			state.sessions = sessions;
			state.revision += 1;
			if (broadcast) state.lastBroadcast = now;
			await this.cache.set(key, state, 10);
			const result: RoomSnapshot & {sessionId?: string} = {
				config,
				generation: state.generation,
				revision: state.revision,
				serverTime: now,
				participants: sessions.map(
					({sessionId: _sessionId, updatedAt: _updatedAt, movedAt: _movedAt, ...state}) => state,
				),
			};
			if (operation.type === 'join') result.sessionId = sessions.find((s) => s.userId === actor.userId)?.sessionId;
			return {result, broadcast};
		});
		if (exchange.broadcast && this.notify) {
			const {sessionId: _sessionId, ...snapshot} = exchange.result;
			await this.notify(
				snapshot,
				snapshot.participants.map((p) => p.userId),
			);
		}
		return exchange.result;
	}
}
