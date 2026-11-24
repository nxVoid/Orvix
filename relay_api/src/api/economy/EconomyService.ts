// SPDX-License-Identifier: AGPL-3.0-or-later
import type {IPostgresClient, PostgresQueryable} from '@pkgs/postgres/src/Client';
import {economySchemaName} from './EconomyMigration';
import {EconomyError, operationFingerprint, periodBounds} from './EconomyPolicy';

export interface EconomyActor {
	id: string;
	premium: boolean;
}
export interface Cosmetic {
	id: string;
	name: string;
	description: string;
	category: string;
	rarity: string;
	price: number;
	asset: string;
	static_asset: string;
	animated: boolean;
	premium: boolean;
	published: boolean;
	starts_at: Date | null;
	ends_at: Date | null;
	stock: number | null;
	sold: number;
	collection_id: string | null;
	event_label: string | null;
}
export interface Mission {
	id: string;
	name: string;
	description: string;
	event: string;
	period: string;
	target: number;
	reward: number;
	premium: boolean;
	premium_bonus: number;
	enabled: boolean;
	starts_at: Date | null;
	ends_at: Date | null;
	version: number;
}
interface Wallet {
	user_id: string;
	balance: number;
	earned: string;
	spent: string;
	reward_today: number;
	reward_day: string | null;
}
interface Progress {
	mission_id: string;
	period_key: string;
	progress: number;
	target: number;
	reward: number;
	premium: boolean;
	premium_bonus: number;
	period_end: Date;
}
interface Receipt {
	transaction_id?: string;
	balance?: number;
	cosmetic_id?: string;
	mission_id?: string;
	amount?: number;
	refunded?: string;
}
type Json = Record<string, unknown>;

/** All currency/ownership writes share a wallet lock and a database transaction. */
export class EconomyService {
	readonly schema: string;
	constructor(
		private readonly client: IPostgresClient,
		schema = 'relay_economy',
		private readonly clock = () => new Date(),
	) {
		this.schema = economySchemaName(schema);
	}

	private async walletLock(db: PostgresQueryable, userId: string): Promise<Wallet> {
		await db.query(`INSERT INTO ${this.schema}.wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING`, [userId]);
		const r = await db.query<Wallet>(
			`SELECT *, reward_day::text AS reward_day FROM ${this.schema}.wallets WHERE user_id=$1 FOR UPDATE`,
			[userId],
		);
		return r.rows[0];
	}

	private async operation(
		actor: EconomyActor,
		key: string,
		input: unknown,
		fn: (db: PostgresQueryable, wallet: Wallet) => Promise<Receipt>,
	): Promise<Receipt> {
		if (!/^[a-zA-Z0-9:_-]{8,128}$/u.test(key)) throw new EconomyError('INVALID_IDEMPOTENCY_KEY', 400);
		const fingerprint = operationFingerprint(input);
		return this.client.transaction(async (db) => {
			const wallet = await this.walletLock(db, actor.id);
			const prior = await db.query<{fingerprint: string; result: Receipt}>(
				`SELECT fingerprint,result FROM ${this.schema}.operations WHERE user_id=$1 AND key=$2`,
				[actor.id, key],
			);
			if (prior.rows[0]) {
				if (prior.rows[0].fingerprint !== fingerprint) throw new EconomyError('IDEMPOTENCY_CONFLICT');
				return prior.rows[0].result;
			}
			const result = await fn(db, wallet);
			await db.query(`INSERT INTO ${this.schema}.operations(user_id,key,fingerprint,result) VALUES($1,$2,$3,$4)`, [
				actor.id,
				key,
				fingerprint,
				JSON.stringify(result),
			]);
			return result;
		});
	}

	private async transact(
		db: PostgresQueryable,
		wallet: Wallet,
		key: string,
		amount: number,
		kind: string,
		reference: string,
		reason: string,
		actorId: string | null = null,
	): Promise<Receipt> {
		if (!Number.isSafeInteger(amount) || Math.abs(amount) > 1000000000) throw new EconomyError('INVALID_AMOUNT', 400);
		const balance = wallet.balance + amount;
		if (balance < 0) throw new EconomyError('INSUFFICIENT_POINTS');
		if (balance > 1000000000) throw new EconomyError('BALANCE_LIMIT');
		await db.query(
			`UPDATE ${this.schema}.wallets SET balance=$2, earned=earned+$3, spent=spent+$4, updated_at=now() WHERE user_id=$1`,
			[
				wallet.user_id,
				balance,
				kind === 'mission' || (kind === 'adjustment' && amount > 0) ? amount : 0,
				kind === 'purchase' ? -amount : 0,
			],
		);
		const r = await db.query<{id: string}>(
			`INSERT INTO ${this.schema}.ledger(user_id,operation_key,amount,balance_after,kind,reference,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
			[wallet.user_id, key, amount, balance, kind, reference, actorId, reason],
		);
		return {transaction_id: String(r.rows[0].id), balance, amount};
	}

	async wallet(userId: string) {
		const r = await this.client.query<Wallet>(
			`SELECT *, reward_day::text AS reward_day FROM ${this.schema}.wallets WHERE user_id=$1`,
			[userId],
		);
		return r.rows[0] ?? {user_id: userId, balance: 0, earned: '0', spent: '0', reward_today: 0, reward_day: null};
	}

	async history(userId: string, before?: string) {
		const r = await this.client.query(
			`SELECT id::text,amount,balance_after,kind,reference,reason,created_at FROM ${this.schema}.ledger WHERE user_id=$1 AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY id DESC LIMIT 51`,
			[userId, before ?? null],
		);
		return {transactions: r.rows.slice(0, 50), next: r.rows.length > 50 ? String(r.rows[49].id) : null};
	}

	async catalog(includeUnpublished = false) {
		return (
			await this.client.query<Cosmetic>(
				`SELECT * FROM ${this.schema}.catalog WHERE $1 OR published ORDER BY collection_id,price,id LIMIT 1000`,
				[includeUnpublished],
			)
		).rows;
	}

	async inventory(actor: EconomyActor) {
		const r = await this.client.query<Cosmetic & {acquired_at: Date; equipped: boolean}>(
			`SELECT c.*,o.acquired_at,(e.cosmetic_id IS NOT NULL AND (NOT c.premium OR $2)) AS equipped FROM ${this.schema}.ownership o JOIN ${this.schema}.catalog c ON c.id=o.cosmetic_id LEFT JOIN ${this.schema}.equipped e ON e.user_id=o.user_id AND e.cosmetic_id=o.cosmetic_id WHERE o.user_id=$1 ORDER BY o.acquired_at DESC`,
			[actor.id, actor.premium],
		);
		return r.rows;
	}

	async purchase(actor: EconomyActor, itemId: string, key: string, expectedPrice?: number) {
		return this.operation(actor, key, ['purchase', itemId, expectedPrice ?? null], async (db, wallet) => {
			const r = await db.query<Cosmetic>(`SELECT * FROM ${this.schema}.catalog WHERE id=$1 FOR UPDATE`, [itemId]);
			const item = r.rows[0];
			if (!item) throw new EconomyError('COSMETIC_NOT_FOUND', 404);
			if (expectedPrice != null && item.price !== expectedPrice) throw new EconomyError('PRICE_CHANGED');
			const owned = await db.query(`SELECT 1 FROM ${this.schema}.ownership WHERE user_id=$1 AND cosmetic_id=$2`, [
				actor.id,
				itemId,
			]);
			if (owned.rowCount) throw new EconomyError('ALREADY_OWNED');
			const now = this.clock();
			if (!item.published || (item.starts_at && now < item.starts_at) || (item.ends_at && now >= item.ends_at))
				throw new EconomyError('NOT_FOR_SALE');
			if (item.premium && !actor.premium) throw new EconomyError('PREMIUM_REQUIRED', 403);
			if (item.stock !== null && item.sold >= item.stock) throw new EconomyError('OUT_OF_STOCK');
			const receipt = await this.transact(db, wallet, key, -item.price, 'purchase', itemId, `Kozmetik: ${item.name}`);
			await db.query(`INSERT INTO ${this.schema}.ownership(user_id,cosmetic_id,transaction_id) VALUES($1,$2,$3)`, [
				actor.id,
				itemId,
				receipt.transaction_id,
			]);
			await db.query(`UPDATE ${this.schema}.catalog SET sold=sold+1 WHERE id=$1`, [itemId]);
			return {...receipt, cosmetic_id: itemId};
		});
	}

	async equip(actor: EconomyActor, category: string, itemId: string | null) {
		await this.client.transaction(async (db) => {
			await this.walletLock(db, actor.id);
			const slots = ['banner', 'animated_banner'].includes(category) ? ['banner', 'animated_banner'] : [category];
			if (itemId === null) {
				await db.query(`DELETE FROM ${this.schema}.equipped WHERE user_id=$1 AND category=ANY($2::text[])`, [
					actor.id,
					slots,
				]);
				return;
			}
			const r = await db.query<Cosmetic>(
				`SELECT c.* FROM ${this.schema}.catalog c JOIN ${this.schema}.ownership o ON o.cosmetic_id=c.id WHERE o.user_id=$1 AND c.id=$2`,
				[actor.id, itemId],
			);
			const item = r.rows[0];
			if (!item || item.category !== category) throw new EconomyError('NOT_OWNED', 403);
			if (item.premium && !actor.premium) throw new EconomyError('PREMIUM_REQUIRED', 403);
			await db.query(`DELETE FROM ${this.schema}.equipped WHERE user_id=$1 AND category=ANY($2::text[])`, [
				actor.id,
				slots,
			]);
			await db.query(
				`INSERT INTO ${this.schema}.equipped(user_id,category,cosmetic_id) VALUES($1,$2,$3) ON CONFLICT(user_id,category) DO UPDATE SET cosmetic_id=excluded.cosmetic_id`,
				[actor.id, category, itemId],
			);
		});
	}

	async active(actor: EconomyActor) {
		return (
			await this.client.query<Cosmetic>(
				`SELECT c.* FROM ${this.schema}.equipped e JOIN ${this.schema}.catalog c ON c.id=e.cosmetic_id WHERE e.user_id=$1 AND (NOT c.premium OR $2)`,
				[actor.id, actor.premium],
			)
		).rows;
	}

	async publicCandidates(ids: ReadonlyArray<string>) {
		const result = await this.client.query<Cosmetic & {user_id: string}>(
			`SELECT c.*,e.user_id FROM ${this.schema}.equipped e JOIN ${this.schema}.catalog c ON c.id=e.cosmetic_id WHERE e.user_id=ANY($1::text[]) AND e.category IN ('avatar_frame','nameplate','name_color')`,
			[ids],
		);
		return result.rows;
	}

	async adjust(adminId: string, userId: string, amount: number, reason: string, key: string) {
		this.reason(reason);
		if (amount === 0) throw new EconomyError('INVALID_AMOUNT', 400);
		return this.operation(
			{id: userId, premium: false},
			key,
			['adjust', adminId, amount, reason],
			async (db, wallet) => {
				const receipt = await this.transact(db, wallet, key, amount, 'adjustment', userId, reason, adminId);
				await this.audit(db, adminId, 'adjust', userId, reason, {amount, ...receipt});
				return receipt;
			},
		);
	}

	async refund(adminId: string, userId: string, transactionId: string, reason: string, key: string) {
		this.reason(reason);
		return this.operation(
			{id: userId, premium: false},
			key,
			['refund', adminId, transactionId, reason],
			async (db, wallet) => {
				const r = await db.query<{amount: number; reference: string}>(
					`SELECT amount,reference FROM ${this.schema}.ledger WHERE user_id=$1 AND id=$2 AND kind='purchase'`,
					[userId, transactionId],
				);
				const original = r.rows[0];
				if (!original) throw new EconomyError('PURCHASE_NOT_FOUND', 404);
				const prior = await db.query(
					`SELECT 1 FROM ${this.schema}.ledger WHERE user_id=$1 AND kind='refund' AND reference=$2`,
					[userId, transactionId],
				);
				if (prior.rowCount) throw new EconomyError('ALREADY_REFUNDED');
				const owned = await db.query(
					`SELECT 1 FROM ${this.schema}.ownership WHERE user_id=$1 AND cosmetic_id=$2 AND transaction_id=$3`,
					[userId, original.reference, transactionId],
				);
				if (!owned.rowCount) throw new EconomyError('OWNERSHIP_CHANGED');
				await db.query(`DELETE FROM ${this.schema}.equipped WHERE user_id=$1 AND cosmetic_id=$2`, [
					userId,
					original.reference,
				]);
				await db.query(`DELETE FROM ${this.schema}.ownership WHERE user_id=$1 AND cosmetic_id=$2`, [
					userId,
					original.reference,
				]);
				await db.query(`UPDATE ${this.schema}.catalog SET sold=sold-1 WHERE id=$1`, [original.reference]);
				const receipt = await this.transact(
					db,
					wallet,
					key,
					-original.amount,
					'refund',
					transactionId,
					reason,
					adminId,
				);
				await this.audit(db, adminId, 'refund', userId, reason, {original: transactionId, ...receipt});
				return {...receipt, refunded: transactionId};
			},
		);
	}

	async missions(actor: EconomyActor) {
		const definitions = (
			await this.client.query<Mission>(
				`SELECT * FROM ${this.schema}.missions WHERE enabled ORDER BY period,id LIMIT 100`,
				[],
			)
		).rows;
		const result = [];
		for (const mission of definitions) {
			const now = this.clock();
			if ((mission.starts_at && now < mission.starts_at) || (mission.ends_at && now >= mission.ends_at)) continue;
			const period = periodBounds(mission.period, now, mission.starts_at, mission.ends_at);
			const p = (
				await this.client.query<Progress & {claimed: boolean}>(
					`SELECT p.*,(c.transaction_id IS NOT NULL) AS claimed FROM ${this.schema}.progress p LEFT JOIN ${this.schema}.claims c USING(user_id,mission_id,period_key) WHERE p.user_id=$1 AND p.mission_id=$2 AND p.period_key=$3`,
					[actor.id, mission.id, period.key],
				)
			).rows[0];
			result.push({
				...mission,
				target: p?.target ?? mission.target,
				reward: p?.reward ?? mission.reward,
				premium: p?.premium ?? mission.premium,
				premium_bonus: p?.premium_bonus ?? mission.premium_bonus,
				progress: p?.progress ?? 0,
				claimed: p?.claimed ?? false,
				period_key: period.key,
				period_end: period.end,
			});
		}
		return result;
	}

	/** Internal only: accepts events already verified by an authenticated server producer. */
	async recordEvent(
		userId: string,
		eventId: string,
		kind: string,
		amount = 1,
		contentHash: string | null = null,
		attestation?: {missionId: string; adminId: string; reason: string},
	) {
		if (!Number.isInteger(amount) || amount < 1 || amount > 60) throw new EconomyError('INVALID_ACTIVITY', 400);
		return this.client.transaction(async (db) => {
			await this.walletLock(db, userId);
			const now = this.clock();
			if (kind === 'message') {
				if (!contentHash) return false;
				const abuse = await db.query(
					`SELECT 1 FROM ${this.schema}.activity WHERE user_id=$1 AND kind='message' AND (created_at>$2 OR (content_hash=$3 AND created_at>$4)) LIMIT 1`,
					[userId, new Date(now.getTime() - 30000), contentHash, new Date(now.getTime() - 86400000)],
				);
				if (abuse.rowCount) return false;
			}
			const event = await db.query(
				`INSERT INTO ${this.schema}.activity(user_id,event_id,kind,content_hash,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_id`,
				[userId, eventId, kind, contentHash, now],
			);
			if (!event.rowCount) return false;
			const definitions = await db.query<Mission>(
				`SELECT * FROM ${this.schema}.missions WHERE enabled AND event=$1 AND (starts_at IS NULL OR starts_at<=$2) AND (ends_at IS NULL OR ends_at>$2) AND ($3::text IS NULL OR id=$3) ORDER BY id LIMIT 100`,
				[kind, now, attestation?.missionId ?? null],
			);
			if (attestation && !definitions.rowCount) throw new EconomyError('MISSION_INACTIVE');
			for (const m of definitions.rows) {
				const p = periodBounds(m.period, now, m.starts_at, m.ends_at);
				await db.query(
					`INSERT INTO ${this.schema}.progress(user_id,mission_id,period_key,progress,target,reward,premium_bonus,premium,version,period_end) VALUES($1,$2,$3,0,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
					[userId, m.id, p.key, m.target, m.reward, m.premium_bonus, m.premium, m.version, p.end],
				);
				await db.query(
					`UPDATE ${this.schema}.progress SET progress=progress+$4 WHERE user_id=$1 AND mission_id=$2 AND period_key=$3`,
					[userId, m.id, p.key, amount],
				);
				await db.query(
					`INSERT INTO ${this.schema}.activity_progress(user_id,event_id,mission_id,period_key,amount) VALUES($1,$2,$3,$4,$5)`,
					[userId, eventId, m.id, p.key, amount],
				);
			}
			if (attestation) {
				await this.audit(db, attestation.adminId, 'mission_attestation', userId, attestation.reason, {
					eventId,
					missionId: attestation.missionId,
				});
			}
			return true;
		});
	}

	async attest(adminId: string, userId: string, missionId: string, eventId: string, reason: string) {
		this.reason(reason);
		const mission = (
			await this.client.query<Mission>(
				`SELECT * FROM ${this.schema}.missions WHERE id=$1 AND event IN ('community','campaign') AND enabled`,
				[missionId],
			)
		).rows[0];
		if (!mission) throw new EconomyError('MISSION_INACTIVE');
		const period = periodBounds(mission.period, this.clock(), mission.starts_at, mission.ends_at);
		return this.recordEvent(userId, `attest:${missionId}:${period.key}:${eventId}`, mission.event, 1, null, {
			missionId,
			adminId,
			reason,
		});
	}

	async revokeMessage(userId: string, messageId: string) {
		return this.revokeMessages(userId, [messageId]);
	}

	async revokeMessages(userId: string, messageIds: ReadonlyArray<string>) {
		return this.client.transaction(async (db) => {
			const wallet = await db.query(`SELECT 1 FROM ${this.schema}.wallets WHERE user_id=$1 FOR UPDATE`, [userId]);
			if (!wallet.rowCount) return false;
			const revoked = await db.query<{event_id: string}>(
				`UPDATE ${this.schema}.activity SET revoked=true WHERE user_id=$1 AND event_id=ANY($2::text[]) AND NOT revoked RETURNING event_id`,
				[userId, messageIds.map((id) => `message:${id}`)],
			);
			if (!revoked.rowCount) return false;
			await db.query(
				`UPDATE ${this.schema}.progress p SET progress=greatest(0,p.progress-a.amount)
				FROM (
					SELECT mission_id,period_key,sum(amount)::integer AS amount
					FROM ${this.schema}.activity_progress WHERE user_id=$1 AND event_id=ANY($2::text[])
					GROUP BY mission_id,period_key
				) a
				WHERE p.user_id=$1 AND p.mission_id=a.mission_id AND p.period_key=a.period_key
				AND NOT EXISTS (
					SELECT 1 FROM ${this.schema}.claims c
					WHERE c.user_id=p.user_id AND c.mission_id=p.mission_id AND c.period_key=p.period_key
				)`,
				[userId, revoked.rows.map((event) => event.event_id)],
			);
			return true;
		});
	}

	async missionHistory(userId: string) {
		return (
			await this.client.query(
				`SELECT c.mission_id,c.period_key,c.claimed_at,l.amount,m.name FROM ${this.schema}.claims c JOIN ${this.schema}.ledger l ON l.id=c.transaction_id JOIN ${this.schema}.missions m ON m.id=c.mission_id WHERE c.user_id=$1 ORDER BY c.claimed_at DESC LIMIT 100`,
				[userId],
			)
		).rows;
	}

	async claim(
		actor: EconomyActor,
		missionId: string,
		periodKey: string,
		key: string,
		verifyMessage?: (eventId: string, contentHash: string) => Promise<boolean>,
	) {
		return this.operation(actor, key, ['claim', missionId, periodKey], async (db, wallet) => {
			const p = (
				await db.query<Progress & {event: string}>(
					`SELECT p.*,m.event FROM ${this.schema}.progress p JOIN ${this.schema}.missions m ON m.id=p.mission_id WHERE p.user_id=$1 AND p.mission_id=$2 AND p.period_key=$3 AND m.enabled`,
					[actor.id, missionId, periodKey],
				)
			).rows[0];
			if (!p || p.period_end <= this.clock() || p.progress < p.target) throw new EconomyError('MISSION_INCOMPLETE');
			if (p.premium && !actor.premium) throw new EconomyError('PREMIUM_REQUIRED', 403);
			const prior = await db.query(
				`SELECT 1 FROM ${this.schema}.claims WHERE user_id=$1 AND mission_id=$2 AND period_key=$3`,
				[actor.id, missionId, periodKey],
			);
			if (prior.rowCount) throw new EconomyError('ALREADY_CLAIMED');
			if (p.event === 'message' && verifyMessage) {
				const candidates = await db.query<{event_id: string; content_hash: string}>(
					`SELECT a.event_id,a.content_hash FROM ${this.schema}.activity_progress ap JOIN ${this.schema}.activity a USING(user_id,event_id) WHERE ap.user_id=$1 AND ap.mission_id=$2 AND ap.period_key=$3 AND NOT a.revoked ORDER BY a.created_at DESC LIMIT 500`,
					[actor.id, missionId, periodKey],
				);
				let verified = 0;
				for (let index = 0; index < candidates.rows.length && verified < p.target; index += 10) {
					const batch = candidates.rows.slice(index, index + 10);
					const checks = await Promise.all(batch.map((entry) => verifyMessage(entry.event_id, entry.content_hash)));
					verified += checks.filter(Boolean).length;
				}
				if (verified < p.target) throw new EconomyError('MISSION_INCOMPLETE');
			}
			const now = this.clock();
			if (p.period_end <= now) throw new EconomyError('MISSION_INCOMPLETE');
			const amount = p.reward + (actor.premium ? p.premium_bonus : 0);
			const day = now.toISOString().slice(0, 10);
			const cap = (
				await db.query<{daily_reward_cap: number}>(`SELECT daily_reward_cap FROM ${this.schema}.settings WHERE id=true`)
			).rows[0].daily_reward_cap;
			const today = wallet.reward_day && String(wallet.reward_day).slice(0, 10) === day ? wallet.reward_today : 0;
			if (today + amount > cap) throw new EconomyError('DAILY_REWARD_LIMIT');
			const receipt = await this.transact(db, wallet, key, amount, 'mission', missionId, `Görev ödülü: ${missionId}`);
			await db.query(`UPDATE ${this.schema}.wallets SET reward_day=$2,reward_today=$3 WHERE user_id=$1`, [
				actor.id,
				day,
				today + amount,
			]);
			await db.query(
				`INSERT INTO ${this.schema}.claims(user_id,mission_id,period_key,transaction_id) VALUES($1,$2,$3,$4)`,
				[actor.id, missionId, periodKey, receipt.transaction_id],
			);
			return {...receipt, mission_id: missionId};
		});
	}

	async saveCosmetic(adminId: string, item: Cosmetic, reason: string) {
		this.reason(reason);
		await this.client.transaction(async (db) => {
			// Category is immutable: existing equip slots and receipts must keep their meaning.
			await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${this.schema}:catalog:${item.id}`]);
			const prior = (await db.query<Cosmetic>(`SELECT * FROM ${this.schema}.catalog WHERE id=$1 FOR UPDATE`, [item.id]))
				.rows[0];
			if (prior && item.stock != null && prior.sold > item.stock) throw new EconomyError('STOCK_BELOW_SOLD');
			if (prior && prior.category !== item.category) throw new EconomyError('CATEGORY_IMMUTABLE');
			await db.query(
				`INSERT INTO ${this.schema}.catalog(id,name,description,category,rarity,price,asset,static_asset,animated,premium,published,starts_at,ends_at,stock,collection_id,event_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,rarity=excluded.rarity,price=excluded.price,asset=excluded.asset,static_asset=excluded.static_asset,animated=excluded.animated,premium=excluded.premium,published=excluded.published,starts_at=excluded.starts_at,ends_at=excluded.ends_at,stock=excluded.stock,collection_id=excluded.collection_id,event_label=excluded.event_label,updated_at=now()`,
				[
					item.id,
					item.name,
					item.description,
					item.category,
					item.rarity,
					item.price,
					item.asset,
					item.static_asset,
					item.animated,
					item.premium,
					item.published,
					item.starts_at,
					item.ends_at,
					item.stock,
					item.collection_id,
					item.event_label,
				],
			);
			await this.audit(db, adminId, 'catalog_update', item.id, reason, {before: prior ?? null, after: item});
		});
	}

	async saveMission(adminId: string, mission: Mission, reason: string) {
		this.reason(reason);
		await this.client.transaction(async (db) => {
			await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${this.schema}:mission:${mission.id}`]);
			const before = (
				await db.query<Mission>(`SELECT * FROM ${this.schema}.missions WHERE id=$1 FOR UPDATE`, [mission.id])
			).rows[0];
			if (before && (before.period !== mission.period || before.event !== mission.event))
				throw new EconomyError('MISSION_IDENTITY_IMMUTABLE');
			await db.query(
				`INSERT INTO ${this.schema}.missions(id,name,description,event,period,target,reward,premium,premium_bonus,enabled,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,target=excluded.target,reward=excluded.reward,premium=excluded.premium,premium_bonus=excluded.premium_bonus,enabled=excluded.enabled,starts_at=excluded.starts_at,ends_at=excluded.ends_at,version=${this.schema}.missions.version+1`,
				[
					mission.id,
					mission.name,
					mission.description,
					mission.event,
					mission.period,
					mission.target,
					mission.reward,
					mission.premium,
					mission.premium_bonus,
					mission.enabled,
					mission.starts_at,
					mission.ends_at,
				],
			);
			await this.audit(db, adminId, 'mission_update', mission.id, reason, {before: before ?? null, after: mission});
		});
	}

	async missionDefinitions() {
		return (await this.client.query<Mission>(`SELECT * FROM ${this.schema}.missions ORDER BY id LIMIT 1000`)).rows;
	}

	async setRewardCap(adminId: string, cap: number, reason: string) {
		this.reason(reason);
		await this.client.transaction(async (db) => {
			await db.query(`UPDATE ${this.schema}.settings SET daily_reward_cap=$1 WHERE id=true`, [cap]);
			await this.audit(db, adminId, 'reward_cap', 'settings', reason, {cap});
		});
	}

	async recordAssetUpload(adminId: string, path: string, reason: string) {
		this.reason(reason);
		await this.audit(this.client, adminId, 'asset_upload', path, reason, {});
	}

	async statistics() {
		const totals = (
			await this.client.query(
				`SELECT count(*)::text AS wallets,coalesce(sum(balance),0)::text AS circulating,coalesce(sum(earned),0)::text AS earned,coalesce(sum(spent),0)::text AS spent FROM ${this.schema}.wallets`,
			)
		).rows[0];
		const audit = (await this.client.query(`SELECT * FROM ${this.schema}.audit ORDER BY id DESC LIMIT 100`)).rows;
		const settings = (
			await this.client.query<{daily_reward_cap: number}>(
				`SELECT daily_reward_cap FROM ${this.schema}.settings WHERE id=true`,
			)
		).rows[0];
		return {...totals, ...settings, audit};
	}

	private reason(reason: string) {
		if (reason.trim().length < 5 || reason.length > 1000) throw new EconomyError('REASON_REQUIRED', 400);
	}
	private async audit(
		db: PostgresQueryable,
		actorId: string,
		action: string,
		targetId: string,
		reason: string,
		details: Json,
	) {
		await db.query(
			`INSERT INTO ${this.schema}.audit(actor_id,action,target_id,reason,details) VALUES($1,$2,$3,$4,$5)`,
			[actorId, action, targetId, reason, JSON.stringify(details)],
		);
	}
}
