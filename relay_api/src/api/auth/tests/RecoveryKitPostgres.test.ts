// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import {
	createAuthHarness,
	createTestAccount,
	createUniqueUsername,
	type TestAccount,
} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {encodeValue} from '@app/api/database/PostgresKvCodec';
import {PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import {migrateRebrandedKvStorage} from '@app/api/database/PostgresKvRebrandMigration';
import {getInstanceConfigRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {
	getDefaultPostgresClient,
	type IPostgresClient,
	initPostgres,
	quoteIdentifier,
	shutdownPostgres,
} from '@pkgs/postgres/src/Client';
import {AccountIdentityModes} from '@relay/constants/src/AccountIdentityConstants';
import {ValidationErrorCodes} from '@relay/constants/src/ValidationErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const enabled = process.env.ORVIX_RECOVERY_POSTGRES_TEST === '1';
const PASSWORD = 'recovery-regression-password-2026';
type Kit = {recovery_key: string; created_at: string};
type Recovery = {token: string; user_id: string; recovery_key: string};
type Account = TestAccount & {username: string};

describe.runIf(enabled)('Recovery API with real PostgreSQL and rebrand storage', () => {
	let harness: ApiTestHarness;
	let client: IPostgresClient;
	let table: string;
	let originalSelfHosted: boolean;
	let originalBreached: boolean;
	beforeAll(async () => {
		originalSelfHosted = Config.instance.selfHosted;
		originalBreached = Config.breachedPasswordCheck.enabled;
		harness = await createAuthHarness();
		// Credentials are read locally and never included in test output or command arguments.
		const defaults = Object.fromEntries(
			fs
				.readFileSync(path.resolve('../config/env/development.env'), 'utf8')
				.split('\n')
				.filter((line) => line && !line.startsWith('#') && line.includes('='))
				.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
		);
		const name = `recovery_regression_${process.pid}`;
		await initPostgres({
			host: process.env.ORVIX_RECOVERY_TEST_PG_HOST ?? '127.0.0.1',
			port: 5432,
			database: defaults.ORVIX_POSTGRES_DATABASE,
			username: defaults.ORVIX_POSTGRES_USERNAME,
			password: defaults.ORVIX_POSTGRES_PASSWORD,
			kvTable: name,
			maxConnections: 1,
			preparedStatements: false,
		});
		client = getDefaultPostgresClient();
		table = quoteIdentifier(name);
		// TEMP table belongs only to this connection and disappears when the test connection closes.
		await client.query(`CREATE TEMP TABLE ${table} (table_name text NOT NULL,partition_key text NOT NULL,
   row_key text NOT NULL,row_data jsonb NOT NULL,expires_at timestamptz,updated_at timestamptz DEFAULT now(),
   sort_id bigint,PRIMARY KEY(table_name,row_key))`);
	});
	beforeEach(async () => {
		await harness.reset();
		await client.query(`DELETE FROM ${table}`);
		setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(client));
		Config.instance.selfHosted = true;
		Config.breachedPasswordCheck.enabled = false;
		await getInstanceConfigRepository().setAccountIdentityMode(AccountIdentityModes.USERNAME, 'setup');
	});
	afterAll(async () => {
		Config.instance.selfHosted = originalSelfHosted;
		Config.breachedPasswordCheck.enabled = originalBreached;
		await harness?.shutdown();
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		await shutdownPostgres();
	});
	async function account(): Promise<Account> {
		Config.instance.selfHosted = false;
		try {
			const username = createUniqueUsername('pgkit');
			return {...(await createTestAccount(harness, {username})), username};
		} finally {
			Config.instance.selfHosted = true;
		}
	}
	async function kit(a: Account): Promise<Kit> {
		return createBuilder<Kit>(harness, a.token).post('/users/@me/recovery-kit').body({password: a.password}).execute();
	}
	async function recover(a: Account, key: string, password = PASSWORD): Promise<Recovery> {
		return createBuilderWithoutAuth<Recovery>(harness)
			.post('/auth/recover')
			.body({login: a.username, recovery_key: key, password})
			.execute();
	}
	async function invalid(login: string, key: string): Promise<void> {
		const {json} = await createBuilderWithoutAuth<{errors: Array<{path: string; code: string}>}>(harness)
			.post('/auth/recover')
			.body({login, recovery_key: key, password: PASSWORD})
			.expect(400, 'INVALID_FORM_BODY')
			.executeWithResponse();
		expect(json.errors.map(({path, code}) => ({path, code}))).toEqual([
			{path: 'recovery_key', code: ValidationErrorCodes.INVALID_RECOVERY_KEY},
		]);
	}
	function rebrand(value: unknown): unknown {
		if (Array.isArray(value)) return value.map(rebrand);
		if (value && typeof value === 'object')
			return Object.fromEntries(
				Object.entries(value).map(([k, v]) => [k === '__fluxer_type' ? '__orvix_type' : k, rebrand(v)]),
			);
		return value;
	}
	async function rows() {
		return (
			await client.query<{
				table_name: string;
				partition_key: string;
				row_key: string;
				row_data: Record<string, unknown>;
			}>(`SELECT table_name,partition_key,row_key,row_data FROM ${table} ORDER BY table_name,row_key`)
		).rows;
	}
	async function emulateRebrand(): Promise<void> {
		for (const row of await rows()) {
			const key = (s: string) =>
				s
					.split('\u001f')
					.map((p) => JSON.stringify(rebrand(JSON.parse(p))))
					.join('\u001f');
			await client.query(
				`UPDATE ${table} SET row_key=$3,partition_key=$4,row_data=$5::jsonb WHERE table_name=$1 AND row_key=$2`,
				[row.table_name, row.row_key, key(row.row_key), key(row.partition_key), JSON.stringify(rebrand(row.row_data))],
			);
		}
		getInstanceConfigRepository().clearCacheForTesting();
	}
	it('accepts an active key and legacy user, resets the password, ends sessions and rotates exactly once', async () => {
		const a = await account(),
			k = await kit(a);
		const result = await recover(a, k.recovery_key);
		expect(result.user_id === a.userId).toBe(true);
		expect(result.recovery_key !== k.recovery_key).toBe(true);
		await createBuilder(harness, a.token).get('/users/@me').expect(401).execute();
		await createBuilderWithoutAuth(harness).post('/auth/login').body({login: a.username, password: PASSWORD}).execute();
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({login: a.username, password: a.password})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
		await invalid(a.username, k.recovery_key);
		expect((await recover(a, result.recovery_key, `${PASSWORD}-next`)).user_id === a.userId).toBe(true);
	});
	it('rejects a wrong key and a correct key belonging to a different account without enumerating accounts', async () => {
		const a = await account(),
			b = await account(),
			k = await kit(a),
			other = await kit(b);
		await invalid(a.username, other.recovery_key);
		await invalid(b.username, k.recovery_key);
		await invalid(createUniqueUsername('missing'), k.recovery_key);
	});
	it('accepts only the originally allowed spaces, dash variants, casing and Crockford aliases', async () => {
		const a = await account(),
			k = await kit(a);
		const formatted = ` ${k.recovery_key.toLowerCase().replaceAll('-', ' \u2011 ').replaceAll('0', 'o').replaceAll('1', 'i')} `;
		expect((await recover({...a, username: ` ${a.username.toUpperCase()} `}, formatted)).user_id === a.userId).toBe(
			true,
		);
	});
	it('does not expire an active legacy PDF simply because its creation date predates the rename', async () => {
		const a = await account(),
			k = await kit(a);
		const record = (await rows()).find((r) => r.table_name === 'user_recovery_kits')!;
		const data = {...record.row_data, created_at: encodeValue(new Date('2024-01-01T00:00:00Z'))};
		await client.query(`UPDATE ${table} SET row_data=$1 WHERE table_name='user_recovery_kits'`, [JSON.stringify(data)]);
		expect((await recover(a, k.recovery_key)).user_id === a.userId).toBe(true);
	});
	it('rejects an expired persisted row and a revoked key', async () => {
		const a = await account(),
			k = await kit(a);
		await client.query(
			`UPDATE ${table} SET expires_at=now()-interval '1 second' WHERE table_name='user_recovery_kits'`,
		);
		await invalid(a.username, k.recovery_key);
		await client.query(`DELETE FROM ${table} WHERE table_name='user_recovery_kits'`);
		await invalid(a.username, k.recovery_key);
	});
	it('rejects a kit that was replaced by a later generation', async () => {
		const a = await account(),
			first = await kit(a),
			second = await kit(a);
		await invalid(a.username, first.recovery_key);
		expect((await recover(a, second.recovery_key)).user_id === a.userId).toBe(true);
	});
	it('migrates post-rename records without modifying recovery or password hashes and remains idempotent', async () => {
		const a = await account(),
			k = await kit(a);
		const original = await rows();
		await emulateRebrand();
		const planned = await migrateRebrandedKvStorage(client);
		expect(planned.changed > 0 && !planned.applied).toBe(true);
		const migrated = await migrateRebrandedKvStorage(client, {apply: true});
		expect(migrated.changed === planned.changed).toBe(true);
		const after = await rows();
		expect(after.length === original.length).toBe(true);
		// Compare all persisted fields as a boolean to keep synthetic auth hashes out of assertion logs.
		expect(JSON.stringify(after) === JSON.stringify(original)).toBe(true);
		expect((await migrateRebrandedKvStorage(client, {apply: true})).changed).toBe(0);
		getInstanceConfigRepository().clearCacheForTesting();
		expect((await recover(a, k.recovery_key)).user_id === a.userId).toBe(true);
	});
	it('loads high-bit BigInt flags from a pre-rename user without coercion or loss of precision', async () => {
		const a = await account(),
			k = await kit(a),
			id = createUserID(BigInt(a.userId));
		const user = await getUserRepository().findUniqueAssert(id);
		const flags = 1n << 60n;
		await getUserRepository().patchUpsert(id, {flags}, user.toRow());
		const reloaded = await getUserRepository().findUniqueAssert(id);
		expect(reloaded.flags).toBe(flags);
		expect((await recover(a, k.recovery_key)).user_id === a.userId).toBe(true);
	});
	it('refuses canonical key collisions atomically rather than overwriting a recovery kit', async () => {
		const a = await account();
		await kit(a);
		const row = (await rows()).find((r) => r.table_name === 'user_recovery_kits')!;
		await client.query(`INSERT INTO ${table}(table_name,partition_key,row_key,row_data) VALUES ($1,$2,$3,$4)`, [
			row.table_name,
			row.partition_key.replaceAll('__fluxer_type', '__orvix_type'),
			row.row_key.replaceAll('__fluxer_type', '__orvix_type'),
			JSON.stringify(rebrand(row.row_data)),
		]);
		const before = JSON.stringify(await rows());
		await expect(migrateRebrandedKvStorage(client, {apply: true})).rejects.toThrow('Canonical key collision');
		await expect(migrateRebrandedKvStorage(client, {apply: true, repairActivityShadows: true})).rejects.toThrow(
			'Canonical key collision',
		);
		expect(JSON.stringify(await rows()) === before).toBe(true);
	});
	it('archives incomplete activity shadows without replacing a complete profile or authentication material', async () => {
		const a = await account(),
			k = await kit(a);
		const user = (await rows()).find((r) => r.table_name === 'users')!;
		const original = JSON.stringify(await rows());
		const active = encodeValue(new Date('2026-01-01T00:00:00Z'));
		await client.query(
			`UPDATE ${table} SET row_key=$2, partition_key=$3, row_data=$4 WHERE table_name='users' AND row_key=$1`,
			[
				user.row_key,
				user.row_key.replaceAll('__fluxer_type', '__orvix_type'),
				user.partition_key.replaceAll('__fluxer_type', '__orvix_type'),
				JSON.stringify(rebrand(user.row_data)),
			],
		);
		await client.query(`INSERT INTO ${table}(table_name,partition_key,row_key,row_data) VALUES ('users',$1,$2,$3)`, [
			user.partition_key,
			user.row_key,
			JSON.stringify({user_id: user.row_data.user_id, last_active_at: active}),
		]);
		await expect(migrateRebrandedKvStorage(client, {apply: true})).rejects.toThrow('Canonical key collision');
		const result = await migrateRebrandedKvStorage(client, {apply: true, repairActivityShadows: true});
		expect(result.archived).toBe(1);
		const after = await rows();
		expect(after.length === JSON.parse(original).length + 1).toBe(true);
		const fixed = after.find((r) => r.table_name === 'users')!;
		const {last_active_at: _oldActivity, ...oldProfile} = user.row_data;
		const {last_active_at: _newActivity, ...newProfile} = fixed.row_data;
		expect(JSON.stringify(oldProfile) === JSON.stringify(newProfile)).toBe(true);
		expect(
			after.some(
				(r) => r.table_name === '__orvix_rebrand_activity_archive_v1' && typeof r.row_data.snapshot_json === 'string',
			),
		).toBe(true);
		expect((await migrateRebrandedKvStorage(client, {apply: true, repairActivityShadows: true})).changed).toBe(0);
		expect((await recover(a, k.recovery_key)).user_id === a.userId).toBe(true);
	});
	it('refuses conflicting full user profiles even when activity repair is enabled', async () => {
		await account();
		const user = (await rows()).find((r) => r.table_name === 'users')!;
		await client.query(`INSERT INTO ${table}(table_name,partition_key,row_key,row_data) VALUES ('users',$1,$2,$3)`, [
			user.partition_key.replaceAll('__fluxer_type', '__orvix_type'),
			user.row_key.replaceAll('__fluxer_type', '__orvix_type'),
			JSON.stringify(rebrand(user.row_data)),
		]);
		const before = JSON.stringify(await rows());
		await expect(migrateRebrandedKvStorage(client, {apply: true, repairActivityShadows: true})).rejects.toThrow(
			'Canonical key collision',
		);
		expect(JSON.stringify(await rows()) === before).toBe(true);
	});
	for (const index of ['users_by_last_active_ip', 'users_by_last_active_ip_trust_key_v1']) {
		it(`preserves both originals and the newest timestamp for duplicate ${index} activity`, async () => {
			const key = JSON.stringify(encodeValue(42n));
			const data = {user_id: 42n, last_active_ip: '127.0.0.1', last_active_at: new Date('2026-01-01T00:00:00Z')};
			await client.query(
				`INSERT INTO ${table}(table_name,partition_key,row_key,row_data) VALUES ($1,$2,$2,$3),($1,$4,$4,$5)`,
				[
					index,
					key,
					JSON.stringify(encodeValue(data)),
					key.replaceAll('__fluxer_type', '__orvix_type'),
					JSON.stringify(rebrand(encodeValue({...data, last_active_at: new Date('2026-02-01T00:00:00Z')}))),
				],
			);
			expect((await migrateRebrandedKvStorage(client, {apply: true, repairActivityShadows: true})).archived).toBe(1);
			const after = await rows();
			expect(after.filter((r) => r.table_name === index)).toHaveLength(1);
			expect((after.find((r) => r.table_name === index)!.row_data.last_active_at as {value: string}).value).toBe(
				'2026-02-01T00:00:00.000Z',
			);
			expect(after.some((r) => r.table_name === '__orvix_rebrand_activity_archive_v1')).toBe(true);
		});
	}
});
