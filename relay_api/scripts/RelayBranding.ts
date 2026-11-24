// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import {KVClient} from '../pkgs/kv_client/src/KVClient';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '../pkgs/postgres/src/Client';
import {initializeConfig} from '../src/api/Config';
import {setDatabaseQueryExecutor} from '../src/api/database/CassandraQueryExecution';
import {PostgresKvQueryExecutor} from '../src/api/database/PostgresKvQueryExecutor';
import {InstanceConfigRepository} from '../src/api/instance/InstanceConfigRepository';
import {loadRecoveryStorageConfig} from './RecoveryStorageEnvironment';

const fields = [
	'product_name',
	'icon_url',
	'symbol_url',
	'logo_url',
	'wordmark_url',
	'favicon_url',
	'favicon_dark_url',
] as const;
const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !['--apply', '--development', '--restore'].includes(arg)))
	throw new Error('Unsupported branding option');
const backup = path.resolve(import.meta.dirname, '../../.orvix/relay-rebrand/instance-branding.before.json');
let repository: InstanceConfigRepository | undefined, kv: KVClient | undefined;
try {
	const config = await loadRecoveryStorageConfig(args.has('--development'));
	initializeConfig(config);
	if (config.database.backend !== 'postgres') throw new Error('This reviewed instance utility requires PostgreSQL');
	await initPostgres(config.postgres);
	setDatabaseQueryExecutor(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
	kv = new KVClient(config.kv);
	repository = new InstanceConfigRepository(kv);
	const current = JSON.parse((await repository.getConfig('app_public_config')) ?? '{}');
	const cdn = config.endpoints.staticCdn.replace(/\/$/, '');
	const previous = args.has('--restore') ? JSON.parse(fs.readFileSync(backup, 'utf8')) : null;
	if (
		previous &&
		(previous.version !== 1 ||
			fields.some((field) => (current.branding?.[field] ?? null) !== (previous.appliedBranding?.[field] ?? null)))
	)
		throw new Error('Later branding edits detected; refusing restore');
	const next = previous
		? previous.branding
		: {
				product_name: 'Relay',
				icon_url: `${cdn}/web/android-chrome-512x512.png`,
				symbol_url: `${cdn}/web/android-chrome-512x512.png`,
				logo_url: `${cdn}/web/android-chrome-512x512.png`,
				wordmark_url: null,
				favicon_url: `${cdn}/web/favicon-32x32.png`,
				favicon_dark_url: `${cdn}/web/favicon-32x32.png`,
			};
	const patch = Object.fromEntries(fields.map((field) => [field, next[field] ?? null]));
	const changed = fields.some((field) => (current.branding?.[field] ?? null) !== patch[field]);
	if (args.has('--apply') && changed) {
		if (!args.has('--restore') && !fs.existsSync(backup)) {
			fs.mkdirSync(path.dirname(backup), {recursive: true, mode: 0o700});
			fs.writeFileSync(
				backup,
				JSON.stringify(
					{
						version: 1,
						appliedBranding: patch,
						branding: Object.fromEntries(fields.map((field) => [field, current.branding?.[field] ?? null])),
					},
					null,
					2,
				),
				{mode: 0o600, flag: 'wx'},
			);
		}
		// Repository validation + compare-and-swap + cache refresh. Deliberately retain released image files.
		await repository.writeAppPublicConfig({branding: patch});
	}
	console.log(
		JSON.stringify({
			changed,
			applied: args.has('--apply') && changed,
			restoring: args.has('--restore'),
			preservedOldImages: true,
		}),
	);
} catch {
	console.error('Instance branding update failed; details suppressed to protect private configuration.');
	process.exitCode = 1;
} finally {
	await repository?.shutdown();
	kv?.close();
	setDatabaseQueryExecutor(null);
	await shutdownPostgres();
}
