// SPDX-License-Identifier: AGPL-3.0-or-later

import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '../pkgs/postgres/src/Client';
import {migrateRebrandedKvStorage} from '../src/api/database/PostgresKvRebrandMigration';
import {loadRecoveryStorageConfig} from './RecoveryStorageEnvironment';

const args = new Set(process.argv.slice(2));
if (
	[...args].some((arg) => !['--apply', '--writers-stopped', '--development', '--repair-activity-shadows'].includes(arg))
)
	throw new Error('Unsupported migration option');
if (args.has('--apply') && !args.has('--writers-stopped')) {
	throw new Error('Stop all API, worker, and Rust service writers; then pass --apply --writers-stopped');
}

let phase = 'configuration';
try {
	const config = await loadRecoveryStorageConfig(args.has('--development'));
	phase = 'connection';
	await initPostgres(config.postgres);
	const client = getDefaultPostgresClient();
	phase = 'migration';
	console.log(
		JSON.stringify(
			await migrateRebrandedKvStorage(client, {
				apply: args.has('--apply'),
				repairActivityShadows: args.has('--repair-activity-shadows'),
			}),
		),
	);
} catch (error) {
	const safeMessages = [
		'Canonical key collision; migration rolled back without merging records',
		'Ambiguous Postgres KV typed envelope; migration refused',
		'Migration row limit exceeded; no changes applied',
	];
	console.error(`Storage compatibility migration failed during ${phase}. No changes were committed.`);
	if (error instanceof Error && safeMessages.includes(error.message)) console.error(error.message);
	process.exitCode = 1;
} finally {
	await shutdownPostgres();
}
