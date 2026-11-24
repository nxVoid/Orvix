// SPDX-License-Identifier: AGPL-3.0-or-later
import type {IPostgresClient} from '@pkgs/postgres/src/Client';

export function economySchemaName(name: string): string {
	if (!/^relay_economy(?:_test_[a-z0-9_]+|_instance_[a-f0-9]{16})?$/u.test(name))
		throw new Error('Invalid economy schema');
	return `"${name}"`;
}

/** Additive adjunct to the existing KV database. Never alters existing user rows. */
export async function migrateEconomy(client: IPostgresClient, schema = 'relay_economy'): Promise<void> {
	const s = economySchemaName(schema);
	await client.transaction(async (db) => {
		await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${schema}:migrations`]);
		await db.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
		await db.query(
			`CREATE TABLE IF NOT EXISTS ${s}.migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
		);
		const applied = await db.query(`SELECT version FROM ${s}.migrations WHERE version=1`);
		if (!applied.rowCount)
			await db.query(`
CREATE TABLE ${s}.wallets (
 user_id text PRIMARY KEY CHECK(user_id ~ '^[0-9]{1,20}$'),
 balance integer NOT NULL DEFAULT 0 CHECK(balance BETWEEN 0 AND 1000000000),
 earned bigint NOT NULL DEFAULT 0 CHECK(earned >= 0), spent bigint NOT NULL DEFAULT 0 CHECK(spent >= 0),
 reward_day date, reward_today integer NOT NULL DEFAULT 0 CHECK(reward_today >= 0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ${s}.operations (
 user_id text NOT NULL REFERENCES ${s}.wallets(user_id), key text NOT NULL CHECK(length(key) BETWEEN 8 AND 128),
 fingerprint text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key)
);
CREATE TABLE ${s}.collections (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', premium boolean NOT NULL DEFAULT false
);
CREATE TABLE ${s}.catalog (
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9_]{1,64}$'), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), description text NOT NULL DEFAULT '',
 category text NOT NULL CHECK(category IN ('avatar_frame','banner','animated_banner','profile_theme','nameplate','name_color','profile_background','profile_effect','badge','premium_collection')),
 rarity text NOT NULL CHECK(rarity IN ('Common','Rare','Epic','Legendary','Mythic')), price integer NOT NULL CHECK(price BETWEEN 0 AND 1000000000),
 asset text NOT NULL, static_asset text NOT NULL, animated boolean NOT NULL DEFAULT false, premium boolean NOT NULL DEFAULT false,
 published boolean NOT NULL DEFAULT false, starts_at timestamptz, ends_at timestamptz,
 stock integer CHECK(stock >= 0), sold integer NOT NULL DEFAULT 0 CHECK(sold >= 0),
 collection_id text REFERENCES ${s}.collections(id), event_label text, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at), CHECK(stock IS NULL OR sold <= stock)
);
CREATE TABLE ${s}.ledger (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id text NOT NULL REFERENCES ${s}.wallets(user_id),
 operation_key text NOT NULL, amount integer NOT NULL CHECK(amount BETWEEN -1000000000 AND 1000000000),
 balance_after integer NOT NULL CHECK(balance_after BETWEEN 0 AND 1000000000),
 kind text NOT NULL CHECK(kind IN ('purchase','mission','adjustment','refund')), reference text NOT NULL,
 actor_id text, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,operation_key)
);
CREATE INDEX ledger_user_page ON ${s}.ledger(user_id,id DESC);
CREATE TABLE ${s}.ownership (
 user_id text NOT NULL REFERENCES ${s}.wallets(user_id), cosmetic_id text NOT NULL REFERENCES ${s}.catalog(id),
 acquired_at timestamptz NOT NULL DEFAULT now(), transaction_id bigint NOT NULL REFERENCES ${s}.ledger(id), PRIMARY KEY(user_id,cosmetic_id)
);
CREATE TABLE ${s}.equipped (
 user_id text NOT NULL, category text NOT NULL, cosmetic_id text NOT NULL,
 PRIMARY KEY(user_id,category), FOREIGN KEY(user_id,cosmetic_id) REFERENCES ${s}.ownership(user_id,cosmetic_id)
);
CREATE TABLE ${s}.missions (
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9_]{1,64}$'), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 description text NOT NULL DEFAULT '', event text NOT NULL CHECK(event IN ('login','message','voice','community','campaign')),
 period text NOT NULL CHECK(period IN ('daily','weekly','event')), target integer NOT NULL CHECK(target BETWEEN 1 AND 1000000),
 reward integer NOT NULL CHECK(reward BETWEEN 1 AND 10000), premium boolean NOT NULL DEFAULT false,
 premium_bonus integer NOT NULL DEFAULT 0 CHECK(premium_bonus BETWEEN 0 AND 10000), enabled boolean NOT NULL DEFAULT true,
 starts_at timestamptz, ends_at timestamptz, version integer NOT NULL DEFAULT 1,
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at), CHECK(period <> 'event' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL))
);
CREATE TABLE ${s}.progress (
 user_id text NOT NULL REFERENCES ${s}.wallets(user_id), mission_id text NOT NULL REFERENCES ${s}.missions(id),
 period_key text NOT NULL, progress integer NOT NULL DEFAULT 0 CHECK(progress >= 0),
 target integer NOT NULL CHECK(target > 0), reward integer NOT NULL CHECK(reward > 0), premium_bonus integer NOT NULL CHECK(premium_bonus >= 0),
 premium boolean NOT NULL, version integer NOT NULL, period_end timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id,period_key)
);
CREATE TABLE ${s}.claims (
 user_id text NOT NULL, mission_id text NOT NULL, period_key text NOT NULL,
 transaction_id bigint NOT NULL REFERENCES ${s}.ledger(id), claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,mission_id,period_key), FOREIGN KEY(user_id,mission_id,period_key) REFERENCES ${s}.progress(user_id,mission_id,period_key)
);
CREATE TABLE ${s}.activity (
 user_id text NOT NULL REFERENCES ${s}.wallets(user_id), event_id text NOT NULL, kind text NOT NULL,
 content_hash text, created_at timestamptz NOT NULL DEFAULT now(), revoked boolean NOT NULL DEFAULT false,
 PRIMARY KEY(user_id,event_id)
);
CREATE INDEX activity_cooldown ON ${s}.activity(user_id,kind,created_at DESC);
CREATE TABLE ${s}.activity_progress (
 user_id text NOT NULL, event_id text NOT NULL, mission_id text NOT NULL, period_key text NOT NULL, amount integer NOT NULL CHECK(amount>0),
 PRIMARY KEY(user_id,event_id,mission_id,period_key),
 FOREIGN KEY(user_id,event_id) REFERENCES ${s}.activity(user_id,event_id),
 FOREIGN KEY(user_id,mission_id,period_key) REFERENCES ${s}.progress(user_id,mission_id,period_key)
);
CREATE TABLE ${s}.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL,
 target_id text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000), details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ${s}.settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), daily_reward_cap integer NOT NULL CHECK(daily_reward_cap BETWEEN 0 AND 1000000));
INSERT INTO ${s}.settings(id,daily_reward_cap) VALUES(true,500);
INSERT INTO ${s}.migrations(version) VALUES(1);
`);
		const v2 = await db.query(`SELECT version FROM ${s}.migrations WHERE version=2`);
		if (v2.rowCount) return;
		await db.query(`
UPDATE ${s}.catalog c
SET category = CASE WHEN c.id='relay_aurora' THEN 'profile_theme' ELSE 'animated_banner' END
WHERE c.collection_id='relay_origins' AND c.category='banner' AND c.animated AND c.sold=0
 AND c.id IN ('relay_aurora','nebula_drift','eclipse','quantum_horizon')
 AND NOT EXISTS (SELECT 1 FROM ${s}.ownership o WHERE o.cosmetic_id=c.id)
 AND NOT EXISTS (SELECT 1 FROM ${s}.audit a WHERE a.action='catalog_update' AND a.target_id=c.id);
UPDATE ${s}.catalog c SET premium=true
WHERE c.id='eclipse_plate' AND c.collection_id='relay_origins' AND c.sold=0
 AND NOT EXISTS (SELECT 1 FROM ${s}.ownership o WHERE o.cosmetic_id=c.id)
 AND NOT EXISTS (SELECT 1 FROM ${s}.audit a WHERE a.action='catalog_update' AND a.target_id=c.id);
ALTER TABLE ${s}.catalog ADD CONSTRAINT cosmetic_category_identity UNIQUE(id,category);
ALTER TABLE ${s}.equipped ADD CONSTRAINT equipped_category_identity
 FOREIGN KEY(cosmetic_id,category) REFERENCES ${s}.catalog(id,category);
CREATE UNIQUE INDEX refund_original_debit ON ${s}.ledger(user_id,reference) WHERE kind='refund';
CREATE INDEX progress_source_lookup ON ${s}.activity_progress(user_id,mission_id,period_key);
INSERT INTO ${s}.migrations(version) VALUES(2);
`);
	});
}
