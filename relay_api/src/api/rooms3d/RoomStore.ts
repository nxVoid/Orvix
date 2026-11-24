// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import type {ICacheService} from '@pkgs/cache/src/ICacheService';
import {getDefaultPostgresClient, type IPostgresClient, quoteIdentifier} from '@pkgs/postgres/src/Client';
import {
	AVATAR_IDS,
	type AvatarId,
	DEFAULT_ROOM_CONFIG,
	type RoomConfig,
	RoomConfigSchema,
} from '@relay/schema/src/domains/rooms3d/RoomSchemas';

export class RoomError extends Error {
	constructor(
		public readonly code: string,
		public readonly status: 400 | 403 | 409 | 429 | 503 = 409,
	) {
		super(code);
	}
}
export class RoomStore {
	readonly schema: string;
	readonly namespace: string;
	constructor(
		private readonly client: IPostgresClient,
		private readonly cache: ICacheService,
	) {
		this.namespace = `orvix_rooms_${createHash('sha256').update(client.kvTable()).digest('hex').slice(0, 16)}`;
		this.schema = quoteIdentifier(this.namespace);
	}
	async migrate() {
		const allowedAvatars = AVATAR_IDS.map((id) => `'${id}'`).join(',');
		await this.client.transaction(async (db) => {
			await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [this.namespace]);
			await db.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
			await db.query(
				`CREATE TABLE IF NOT EXISTS ${this.schema}.configuration(channel_id text PRIMARY KEY, config jsonb NOT NULL CHECK ((config->>'maxParticipants')::integer BETWEEN 1 AND 16), updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
			);
			await db.query(
				`CREATE TABLE IF NOT EXISTS ${this.schema}.avatar_preferences(user_id text PRIMARY KEY, avatar_id text NOT NULL CHECK(avatar_id IN (${allowedAvatars})))`,
			);
			await db.query(
				`CREATE TABLE IF NOT EXISTS ${this.schema}.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, channel_id text NOT NULL, actor_id text NOT NULL, config jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
			);
			await db.query(`CREATE TABLE IF NOT EXISTS ${this.schema}.migration(version integer PRIMARY KEY)`);
			await db.query(`INSERT INTO ${this.schema}.migration VALUES(1) ON CONFLICT DO NOTHING`);
			const current = await db.query<{version: number}>(`SELECT max(version) as version FROM ${this.schema}.migration`);
			const version = current.rows[0]?.version ?? 1;
			if (version < 2) {
				await db.query(
					`ALTER TABLE ${this.schema}.avatar_preferences DROP CONSTRAINT IF EXISTS avatar_preferences_avatar_id_check`,
				);
				await db.query(
					`ALTER TABLE ${this.schema}.avatar_preferences ADD CONSTRAINT avatar_preferences_avatar_id_check CHECK(avatar_id IN (${allowedAvatars}))`,
				);
				await db.query(`INSERT INTO ${this.schema}.migration VALUES(2) ON CONFLICT DO NOTHING`);
			}
		});
	}
	async config(channelId: string): Promise<RoomConfig> {
		const rows = await this.client.query<{config: RoomConfig}>(
			`SELECT config FROM ${this.schema}.configuration WHERE channel_id=$1`,
			[channelId],
		);
		return rows.rows[0] ? RoomConfigSchema.parse(rows.rows[0].config) : {...DEFAULT_ROOM_CONFIG};
	}
	async configure(channelId: string, actorId: string, config: RoomConfig) {
		await this.client.transaction(async (db) => {
			await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${this.namespace}:${channelId}`]);
			await db.query(
				`INSERT INTO ${this.schema}.configuration(channel_id,config,updated_by) VALUES($1,$2,$3) ON CONFLICT(channel_id) DO UPDATE SET config=$2,updated_by=$3,updated_at=now()`,
				[channelId, config, actorId],
			);
			await db.query(`INSERT INTO ${this.schema}.audit(channel_id,actor_id,config) VALUES($1,$2,$3)`, [
				channelId,
				actorId,
				config,
			]);
			// Invalidate every session on template/access/capacity changes, never disconnect voice.
			await this.cache.delete(`${this.namespace}:${channelId}`);
		});
	}
	async avatar(userId: string): Promise<AvatarId> {
		const rows = await this.client.query<{avatar_id: AvatarId}>(
			`SELECT avatar_id FROM ${this.schema}.avatar_preferences WHERE user_id=$1`,
			[userId],
		);
		return rows.rows[0]?.avatar_id ?? 'violet';
	}
	async saveAvatar(userId: string, avatarId: AvatarId) {
		await this.client.query(
			`INSERT INTO ${this.schema}.avatar_preferences VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET avatar_id=$2`,
			[userId, avatarId],
		);
	}
	async locked<T>(channelId: string, fn: (key: string) => Promise<T>): Promise<T> {
		return this.client.transaction(async (db) => {
			await db.query("SET LOCAL lock_timeout = '1500ms'");
			const key = `${this.namespace}:${channelId}`;
			await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
			return fn(key);
		});
	}
}
let store: Promise<RoomStore> | undefined;
export function getRoomStore(cache: ICacheService) {
	if (!store)
		store = (async () => {
			const s = new RoomStore(getDefaultPostgresClient(), cache);
			await s.migrate();
			return s;
		})().catch((error) => {
			store = undefined;
			throw error;
		});
	return store;
}
