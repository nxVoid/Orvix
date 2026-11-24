// SPDX-License-Identifier: AGPL-3.0-or-later

import {isDeepStrictEqual} from 'node:util';
import {decodeValue, normalizeRebrandedKey, normalizeRebrandedValue} from '@app/api/database/PostgresKvCodec';
import {type IPostgresClient, quoteIdentifier} from '@pkgs/postgres/src/Client';

interface StoredRow {
	table_name: string;
	partition_key: string;
	row_key: string;
	row_data: Record<string, unknown>;
	expires_at: Date | null;
	updated_at: Date;
	sort_id: string | null;
}

const ARCHIVE_TABLE = '__orvix_rebrand_activity_archive_v1';
const ACTIVITY_INDEXES = new Set(['users_by_last_active_ip', 'users_by_last_active_ip_trust_key_v1']);
const SHADOW_FIELDS = new Set(['user_id', 'last_active_at', 'last_active_ip']);
const collision = () => new Error('Canonical key collision; migration rolled back without merging records');
const equal = isDeepStrictEqual;

// This exception repairs only incomplete activity writes and identical activity indexes.
// Full profiles, passwords, recovery records and conflicting security fields are never merged.
function repairActivityPair(first: StoredRow, second: StoredRow): [StoredRow, StoredRow] {
	if (!equal(first.expires_at, second.expires_at) || first.sort_id !== second.sort_id) throw collision();
	const a = normalizeRebrandedValue(first.row_data) as Record<string, unknown>;
	const b = normalizeRebrandedValue(second.row_data) as Record<string, unknown>;
	let complete = a;
	if (first.table_name === 'users') {
		const aFull = typeof a.username === 'string' && typeof a.password_hash === 'string';
		const bFull = typeof b.username === 'string' && typeof b.password_hash === 'string';
		if (aFull === bFull) throw collision();
		complete = aFull ? a : b;
		const shadow = aFull ? b : a;
		if (
			!equal(shadow.user_id, complete.user_id) ||
			Object.keys(shadow).some(
				(key) => !SHADOW_FIELDS.has(key) || (key !== 'last_active_at' && !equal(shadow[key], complete[key])),
			)
		)
			throw collision();
	} else if (ACTIVITY_INDEXES.has(first.table_name)) {
		const withoutActivity = (row: Record<string, unknown>) =>
			Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'last_active_at'));
		if (!equal(withoutActivity(a), withoutActivity(b))) throw collision();
	} else throw collision();
	const aTime = decodeValue(a.last_active_at),
		bTime = decodeValue(b.last_active_at);
	if (
		!(aTime instanceof Date) ||
		!(bTime instanceof Date) ||
		!Number.isFinite(aTime.getTime()) ||
		!Number.isFinite(bTime.getTime())
	)
		throw collision();
	const after = {
		...first,
		row_key: normalizeRebrandedKey(first.row_key),
		partition_key: normalizeRebrandedKey(first.partition_key),
		row_data: {...complete, last_active_at: aTime > bTime ? a.last_active_at : b.last_active_at},
	};
	const archiveKey = JSON.stringify([second.table_name, second.row_key]);
	const archived = {
		...second,
		table_name: ARCHIVE_TABLE,
		row_key: archiveKey,
		partition_key: archiveKey,
		// Keep both original records as JSON text; the PostgreSQL dump preserves timestamp precision.
		row_data: {snapshot_json: JSON.stringify([first, second])},
		expires_at: null,
	};
	return [after, archived];
}

// Stop all writers first. All unrelated collisions abort the entire transaction.
export async function migrateRebrandedKvStorage(
	client: Pick<IPostgresClient, 'transaction' | 'kvTable'>,
	options: {apply?: boolean; maxRows?: number; repairActivityShadows?: boolean} = {},
): Promise<{scanned: number; changed: number; archived: number; applied: boolean}> {
	const table = quoteIdentifier(client.kvTable());
	const maxRows = options.maxRows ?? 100_000;
	if (!Number.isSafeInteger(maxRows) || maxRows < 1) throw new Error('Invalid migration row limit');
	return client.transaction(async (db) => {
		await db.query("SET LOCAL lock_timeout = '10s'");
		await db.query(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`);
		const {rows} = await db.query<StoredRow>(
			`SELECT table_name, partition_key, row_key, row_data, expires_at, updated_at, sort_id FROM ${table} ORDER BY table_name, row_key LIMIT $1`,
			[maxRows + 1],
		);
		if (rows.length > maxRows) throw new Error('Migration row limit exceeded; no changes applied');
		const groups = new Map<string, Array<StoredRow>>();
		for (const row of rows) {
			const id = JSON.stringify([row.table_name, normalizeRebrandedKey(row.row_key)]);
			groups.set(id, [...(groups.get(id) ?? []), row]);
		}
		const targets = new Set<string>();
		const changes: Array<{before: StoredRow; after: StoredRow}> = [];
		let archived = 0;
		for (const group of groups.values()) {
			if (group.length > 1) {
				if (!options.repairActivityShadows || group.length !== 2) throw collision();
				const [first, second] = group;
				const repaired = repairActivityPair(first, second);
				// Move the second row into the archive BEFORE assigning its canonical key.
				changes.push({before: second, after: repaired[1]}, {before: first, after: repaired[0]});
				archived++;
				for (const after of repaired) {
					const identity = JSON.stringify([after.table_name, after.row_key]);
					if (targets.has(identity)) throw collision();
					targets.add(identity);
				}
				continue;
			}
			const [before] = group;
			const after = {
				...before,
				row_key: normalizeRebrandedKey(before.row_key),
				partition_key: normalizeRebrandedKey(before.partition_key),
				row_data: normalizeRebrandedValue(before.row_data) as Record<string, unknown>,
			};
			const identity = JSON.stringify([after.table_name, after.row_key]);
			if (targets.has(identity))
				throw new Error('Canonical key collision; migration rolled back without merging records');
			targets.add(identity);
			if (
				after.row_key !== before.row_key ||
				after.partition_key !== before.partition_key ||
				JSON.stringify(after.row_data) !== JSON.stringify(before.row_data)
			)
				changes.push({before, after});
		}
		if (options.apply) {
			for (const {before, after} of changes) {
				const result = await db.query(
					`UPDATE ${table} SET partition_key=$3, row_key=$4, row_data=$5::jsonb, table_name=$6,
     expires_at=CASE WHEN $6=$7 THEN NULL ELSE expires_at END
     WHERE table_name=$1 AND row_key=$2`,
					[
						before.table_name,
						before.row_key,
						after.partition_key,
						after.row_key,
						JSON.stringify(after.row_data),
						after.table_name,
						ARCHIVE_TABLE,
					],
				);
				if (result.rowCount !== 1) throw new Error('Unexpected migration update count; transaction rolled back');
			}
		}
		return {scanned: rows.length, changed: changes.length, archived, applied: options.apply === true};
	});
}
