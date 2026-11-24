// SPDX-License-Identifier: AGPL-3.0-or-later
import {KVCacheProvider} from '@pkgs/cache/src/providers/KVCacheProvider';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {
	distanceGain,
	interpolationFactor,
	moveAvatar,
	roomObstacles,
} from '@relay/schema/src/domains/rooms3d/RoomGeometry';
import {
	DEFAULT_ROOM_CONFIG,
	type MovementInput,
	MovementSchema,
	RoomConfigSchema,
} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {describe, expect, it} from 'vitest';
import {RoomSession} from './RoomSession';

export class SerialRoomLock {
	private readonly tails = new Map<string, Promise<unknown>>();
	locked<T>(id: string, fn: (key: string) => Promise<T>): Promise<T> {
		const task = (this.tails.get(id) ?? Promise.resolve()).catch(() => {}).then(() => fn(id));
		this.tails.set(id, task);
		return task;
	}
}
function setup() {
	const cache = new KVCacheProvider({client: new MockKVProvider()});
	let now = 10000;
	const session = new RoomSession(new SerialRoomLock(), cache, () => now);
	const members = new Set(Array.from({length: 20}, (_, i) => `${i}:c${i}`));
	return {
		session,
		members,
		advance: (ms = 100) => {
			now += ms;
		},
		join: (i: number, room = 'room') =>
			session.exchange(room, {userId: String(i), connectionId: `c${i}`}, members, DEFAULT_ROOM_CONFIG, {
				type: 'join',
				avatarId: 'violet',
			}),
	};
}
function input(sessionId: string, sequence = 1): MovementInput {
	return {sessionId, connectionId: 'c0', sequence, x: 1, z: 0, run: false, rotationY: 0};
}

describe('3D room schemas and movement', () => {
	it('rejects arbitrary assets, nonfinite coordinates, spoofed identities and oversized capacity', () => {
		const base = input('2eb2c739-2dd8-4fb5-a1f2-ac7b6fb1211e');
		for (const x of [NaN, Infinity, -Infinity, 2]) expect(MovementSchema.safeParse({...base, x}).success).toBe(false);
		expect(MovementSchema.safeParse({...base, userId: 'spoof'}).success).toBe(false);
		expect(RoomConfigSchema.safeParse({...DEFAULT_ROOM_CONFIG, maxParticipants: 17}).success).toBe(false);
		expect(
			RoomConfigSchema.safeParse({...DEFAULT_ROOM_CONFIG, assetUrl: 'https://untrusted.invalid/a.glb'}).success,
		).toBe(false);
	});
	it('bounds speed, diagonal movement, elapsed time and walls', () => {
		const p = {x: 0, y: 0, z: 6};
		expect(moveAvatar(p, {x: 1, z: 1, run: false}, 0.1, 'gaming').x).toBeCloseTo(0.3 / Math.sqrt(2));
		expect(moveAvatar(p, {x: 1, z: 0, run: true}, 100, 'gaming').x).toBe(1);
		expect(moveAvatar({x: 9.4, y: 0, z: 6}, {x: 1, z: 0, run: true}, 0.2, 'gaming').x).toBe(9.5);
		for (const template of ['gaming', 'meeting', 'cinema'] as const) {
			const o = roomObstacles(template)[0];
			const start = {x: o.x - o.width / 2 - 0.4, y: 0, z: o.z};
			expect(moveAvatar(start, {x: 1, z: 0, run: true}, 0.2, template).x).toBe(start.x);
		}
	});
	it('has bounded distance attenuation and timestep-independent interpolation', () => {
		expect(distanceGain(0)).toBe(1);
		expect(distanceGain(100)).toBeCloseTo(0.15);
		expect(distanceGain(NaN)).toBe(1);
		const a = interpolationFactor(1 / 60);
		expect(1 - (1 - a) ** 2).toBeCloseTo(interpolationFactor(1 / 30));
	});
});
describe('authoritative room sessions', () => {
	it('admits exactly 16 simultaneous joins and isolates room snapshots', async () => {
		const s = setup();
		const results = await Promise.allSettled(Array.from({length: 20}, (_, i) => s.join(i)));
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(16);
		expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
		const separate = await s.join(19, 'private-other');
		expect(separate.participants).toHaveLength(1);
	});
	it('never exposes another user session token and rejects identity/connection spoofing', async () => {
		const s = setup();
		await s.join(0);
		const joined = await s.join(1);
		expect(joined.participants.every((p) => !('sessionId' in p))).toBe(true);
		await expect(
			s.session.exchange('room', {userId: '99', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
				type: 'join',
				avatarId: 'violet',
			}),
		).rejects.toMatchObject({code: 'VOICE_MEMBERSHIP_REQUIRED'});
	});
	it('rejects stale sequences, fast updates and stale sessions; old leave cannot evict a replacement', async () => {
		const s = setup();
		const j = await s.join(0);
		s.advance();
		await s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
			type: 'move',
			input: input(j.sessionId!),
		});
		await expect(
			s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
				type: 'move',
				input: input(j.sessionId!),
			}),
		).rejects.toMatchObject({code: 'STALE_SEQUENCE'});
		await expect(
			s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
				type: 'move',
				input: input(j.sessionId!, 2),
			}),
		).rejects.toMatchObject({code: 'MOVEMENT_RATE_LIMIT'});
		const replacement = await s.join(0);
		const result = await s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
			type: 'leave',
			sessionId: j.sessionId!,
		});
		expect(result.participants).toHaveLength(1);
		expect(replacement.sessionId).not.toBe(j.sessionId);
	});
	it('cleans kicked, disconnected and expired presence; ordinary voice users consume no slots', async () => {
		const s = setup();
		await s.join(0);
		s.members.delete('0:c0');
		expect((await s.join(1)).participants).toHaveLength(1);
		s.advance(5001);
		expect((await s.join(2)).participants.map((p) => p.userId)).toEqual(['2']);
	});
	it('checks current config inside the serialized operation', async () => {
		const s = setup();
		await expect(
			s.session.exchange(
				'room',
				{userId: '0', connectionId: 'c0'},
				s.members,
				async () => ({...DEFAULT_ROOM_CONFIG, enabled: false}),
				{type: 'join', avatarId: 'violet'},
			),
		).rejects.toMatchObject({code: 'ROOM_DISABLED'});
	});
	it('rejoins after expiry without duplicate avatars and cannot reuse a replaced token', async () => {
		const s = setup();
		const first = await s.join(0);
		s.advance(5100);
		await expect(
			s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
				type: 'move',
				input: input(first.sessionId!, 1),
			}),
		).rejects.toMatchObject({code: 'ROOM_SESSION_EXPIRED'});
		const replacement = await s.join(0);
		expect(replacement.participants).toHaveLength(1);
		s.advance();
		await expect(
			s.session.exchange('room', {userId: '0', connectionId: 'c0'}, s.members, DEFAULT_ROOM_CONFIG, {
				type: 'move',
				input: input(first.sessionId!, 2),
			}),
		).rejects.toMatchObject({code: 'ROOM_SESSION_REPLACED'});
	});
	it('coalesces movement broadcasts to the room cadence and excludes admission tokens', async () => {
		const cache = new KVCacheProvider({client: new MockKVProvider()});
		let now = 1000;
		const frames: Array<unknown> = [];
		const service = new RoomSession(
			new SerialRoomLock(),
			cache,
			() => now,
			async (frame, users) => {
				frames.push({frame, users});
			},
		);
		const members = new Set(['0:c0', '1:c1']);
		const j = await service.exchange('room', {userId: '0', connectionId: 'c0'}, members, DEFAULT_ROOM_CONFIG, {
			type: 'join',
			avatarId: 'violet',
		});
		now += 60;
		await service.exchange('room', {userId: '0', connectionId: 'c0'}, members, DEFAULT_ROOM_CONFIG, {
			type: 'move',
			input: input(j.sessionId!, 1),
		});
		expect(frames).toHaveLength(1);
		now += 60;
		await service.exchange('room', {userId: '0', connectionId: 'c0'}, members, DEFAULT_ROOM_CONFIG, {
			type: 'move',
			input: input(j.sessionId!, 2),
		});
		expect(frames).toHaveLength(2);
		expect(JSON.stringify(frames)).not.toContain(j.sessionId);
	});
	it('processes 16 moving users with bounded consistent snapshots', async () => {
		const s = setup();
		const joins = await Promise.all(Array.from({length: 16}, (_, i) => s.join(i)));
		let bytes = 0;
		const start = performance.now();
		for (let sequence = 1; sequence <= 100; sequence++) {
			s.advance();
			const frames = await Promise.all(
				joins.map((j, i) =>
					s.session.exchange('room', {userId: String(i), connectionId: `c${i}`}, s.members, DEFAULT_ROOM_CONFIG, {
						type: 'move',
						input: {...input(j.sessionId!, sequence), connectionId: `c${i}`},
					}),
				),
			);
			for (const frame of frames) {
				expect(new Set(frame.participants.map((p) => p.userId)).size).toBe(16);
				bytes += Buffer.byteLength(JSON.stringify(frame));
			}
		}
		console.info(
			JSON.stringify({
				simulation: '16 participants, 100 updates each, mock cache/serialized lock',
				updates: 1600,
				elapsedMs: Math.round(performance.now() - start),
				totalSnapshotBytes: bytes,
			}),
		);
	});
});
