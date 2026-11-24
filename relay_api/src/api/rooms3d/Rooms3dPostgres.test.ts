// SPDX-License-Identifier: AGPL-3.0-or-later
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {KVCacheProvider} from '@pkgs/cache/src/providers/KVCacheProvider';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {DEFAULT_ROOM_CONFIG} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {RoomSession} from './RoomSession';
import {RoomStore} from './RoomStore';

describe.runIf(process.env.ORVIX_ROOMS_POSTGRES_TEST === '1')(
	'isolated room PostgreSQL persistence and concurrency',
	() => {
		let store: RoomStore;
		let second: RoomStore;
		let initialized = false;
		const cache = new KVCacheProvider({client: new MockKVProvider()});
		beforeAll(async () => {
			const env = Object.fromEntries(
				readFileSync('../config/env/development.env', 'utf8')
					.split('\n')
					.flatMap((line) => {
						const i = line.indexOf('=');
						return i > 0 && !line.startsWith('#') ? [[line.slice(0, i), line.slice(i + 1).trim()]] : [];
					}),
			);
			await initPostgres({
				host: process.env.ORVIX_ROOMS_TEST_PG_HOST ?? 'postgres',
				database: env.ORVIX_POSTGRES_DATABASE,
				username: env.ORVIX_POSTGRES_USERNAME,
				password: env.ORVIX_POSTGRES_PASSWORD,
				maxConnections: 4,
			});
			initialized = true;
			const db = getDefaultPostgresClient();
			const isolated = {
				query: db.query.bind(db),
				transaction: db.transaction.bind(db),
				session: db.session.bind(db),
				connect: db.connect.bind(db),
				shutdown: db.shutdown.bind(db),
				kvTable: () => `rooms3d_test_${nonce}`,
			};
			store = new RoomStore(isolated, cache);
			second = new RoomStore(isolated, cache);
			await Promise.all([store.migrate(), second.migrate()]);
		});
		const nonce = randomBytes(8).toString('hex');
		afterAll(async () => {
			if (!initialized) return;
			try {
				if (store) await getDefaultPostgresClient().query(`DROP SCHEMA ${store.schema} CASCADE`);
			} finally {
				await shutdownPostgres();
			}
		});
		it('persists one config and avatar preference, audits changes and supports repeated migration', async () => {
			await store.configure('1', '9', {...DEFAULT_ROOM_CONFIG, templateId: 'meeting'});
			expect((await second.config('1')).templateId).toBe('meeting');
			await store.saveAvatar('9', 'mint');
			expect(await second.avatar('9')).toBe('mint');
			await store.migrate();
			expect(await second.avatar('9')).toBe('mint');
			const audit = await getDefaultPostgresClient().query(
				`SELECT count(*)::integer AS count FROM ${store.schema}.audit`,
			);
			expect(audit.rows[0].count).toBe(1);
		});
		it('uses real advisory locks across service instances for a 20-way capacity race', async () => {
			const members = new Set(Array.from({length: 20}, (_, i) => `${i}:c${i}`));
			const services = [new RoomSession(store, cache), new RoomSession(second, cache)];
			const results = await Promise.allSettled(
				Array.from({length: 20}, (_, i) =>
					services[i % 2].exchange('race', {userId: String(i), connectionId: `c${i}`}, members, DEFAULT_ROOM_CONFIG, {
						type: 'join',
						avatarId: 'lunar',
					}),
				),
			);
			expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(16);
			expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
		});
	},
);
