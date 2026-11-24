// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {INITIAL_COSMETICS} from './EconomyCatalog';
import {economySchemaName, migrateEconomy} from './EconomyMigration';
import {meaningfulMessage, periodBounds} from './EconomyPolicy';
import {initializeEconomy} from './EconomyRuntime';
import {EconomyService} from './EconomyService';

describe('Economy policy', () => {
	it('uses UTC and Monday weeks across year boundaries', () => {
		const now = new Date('2027-01-03T23:59:59Z');
		expect(periodBounds('weekly', now)).toEqual({key: '2026-12-28', end: new Date('2027-01-04T00:00:00Z')});
		expect(periodBounds('daily', new Date('2027-01-04T00:00:00Z')).key).toBe('2027-01-04');
	});
	it('rejects short and repetitive spam and canonicalizes punctuation', () => {
		expect(meaningfulMessage('aaaaaaaaaaaaaaaaaa')).toBeNull();
		expect(meaningfulMessage('https://example.com/anything')).toBeNull();
		expect(meaningfulMessage('A useful discussion today!')).toBe(meaningfulMessage('a useful discussion TODAY.'));
	});
});

describe.runIf(process.env.RELAY_ECONOMY_POSTGRES_TEST === '1')('Economy PostgreSQL transactions', () => {
	const schema = `relay_economy_test_${randomBytes(6).toString('hex')}`;
	const sqlSchema = economySchemaName(schema);
	let service: EconomyService;
	let now = new Date('2026-11-11T12:00:00Z');
	let initialized = false;

	beforeAll(async () => {
		const settings = Object.fromEntries(
			readFileSync('../config/env/development.env', 'utf8')
				.split('\n')
				.flatMap((line) => {
					const i = line.indexOf('=');
					return i > 0 && !line.startsWith('#') ? [[line.slice(0, i), line.slice(i + 1).trim()]] : [];
				}),
		);
		await initPostgres({
			host: process.env.RELAY_ECONOMY_TEST_PG_HOST ?? '127.0.0.1',
			database: settings.ORVIX_POSTGRES_DATABASE,
			username: settings.ORVIX_POSTGRES_USERNAME,
			password: settings.ORVIX_POSTGRES_PASSWORD,
			maxConnections: 4,
		});
		initialized = true;
		const client = getDefaultPostgresClient();
		await Promise.all([migrateEconomy(client, schema), initializeEconomy(client, schema)]);
		service = new EconomyService(client, schema, () => now);
	});

	afterAll(async () => {
		if (!initialized) return;
		try {
			await getDefaultPostgresClient().query(`DROP SCHEMA IF EXISTS ${sqlSchema} CASCADE`);
		} finally {
			await shutdownPostgres();
		}
	});

	async function addItem(id: string, price: number, premium = false, stock: number | null = null) {
		await service.saveCosmetic(
			'900',
			{...INITIAL_COSMETICS[0], id, price, premium, stock, collection_id: null},
			'Test catalog setup',
		);
	}

	it('atomically debits, creates ownership and replays a purchase', async () => {
		const actor = {id: '101', premium: false};
		await addItem('purchase', 75);
		await expect(service.purchase(actor, 'purchase', 'first-buy')).rejects.toMatchObject({code: 'INSUFFICIENT_POINTS'});
		await service.adjust('900', actor.id, 100, 'Test opening balance', 'grant-101');
		const receipt = await service.purchase(actor, 'purchase', 'first-buy');
		expect(receipt.balance).toBe(25);
		expect(await service.purchase(actor, 'purchase', 'first-buy')).toEqual(receipt);
		await expect(service.purchase(actor, 'another', 'first-buy')).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
		await expect(service.purchase(actor, 'purchase', 'second-buy')).rejects.toMatchObject({code: 'ALREADY_OWNED'});
		expect(await service.inventory(actor)).toHaveLength(1);
		expect((await service.history(actor.id)).transactions).toHaveLength(2);
	});

	it('serializes different purchases against the same balance', async () => {
		const actor = {id: '102', premium: false};
		await addItem('race_one', 70);
		await addItem('race_two', 70);
		await service.adjust('900', actor.id, 100, 'Test opening balance', 'grant-102');
		const attempts = await Promise.allSettled([
			service.purchase(actor, 'race_one', 'purchase-race-1'),
			service.purchase(actor, 'race_two', 'purchase-race-2'),
		]);
		expect(attempts.filter(({status}) => status === 'fulfilled')).toHaveLength(1);
		expect(await service.wallet(actor.id)).toMatchObject({balance: 30, spent: '70'});
		expect(await service.inventory(actor)).toHaveLength(1);
	});

	it('serializes limited stock across wallets', async () => {
		await addItem('limited', 0, false, 1);
		const attempts = await Promise.allSettled([
			service.purchase({id: '103', premium: false}, 'limited', 'limited-first'),
			service.purchase({id: '104', premium: false}, 'limited', 'limited-second'),
		]);
		expect(attempts.filter(({status}) => status === 'fulfilled')).toHaveLength(1);
		expect(attempts.find(({status}) => status === 'rejected')).toMatchObject({reason: {code: 'OUT_OF_STOCK'}});
	});

	it('filters premium equip on entitlement loss, supports removal and refunds once', async () => {
		const actor = {id: '105', premium: true};
		await addItem('premium', 25, true);
		await service.adjust('900', actor.id, 50, 'Test opening balance', 'grant-105');
		const receipt = await service.purchase(actor, 'premium', 'premium-buy');
		await service.equip(actor, 'avatar_frame', 'premium');
		expect(await service.active(actor)).toHaveLength(1);
		expect(await service.active({...actor, premium: false})).toEqual([]);
		expect(await service.inventory({...actor, premium: false})).toMatchObject([{id: 'premium', equipped: false}]);
		await service.equip(actor, 'avatar_frame', null);
		expect(await service.active(actor)).toEqual([]);
		await service.refund('900', actor.id, receipt.transaction_id!, 'Test refund reason', 'refund-first');
		expect(await service.wallet(actor.id)).toMatchObject({balance: 50});
		expect(await service.inventory(actor)).toEqual([]);
		await expect(
			service.refund('900', actor.id, receipt.transaction_id!, 'Test refund reason', 'refund-second'),
		).rejects.toMatchObject({code: 'ALREADY_REFUNDED'});
	});

	it('deduplicates activity, revokes a deleted message and only awards one claim', async () => {
		const actor = {id: '106', premium: false};
		await service.saveMission(
			'900',
			{
				id: 'daily_message_test',
				name: 'Message',
				description: '',
				event: 'message',
				period: 'daily',
				target: 1,
				reward: 20,
				premium: false,
				premium_bonus: 0,
				enabled: true,
				starts_at: null,
				ends_at: null,
				version: 1,
			},
			'Test mission setup',
		);
		expect(await service.recordEvent(actor.id, 'message:10', 'message', 1, 'first')).toBe(true);
		expect(await service.recordEvent(actor.id, 'message:11', 'message', 1, 'second')).toBe(false);
		await service.revokeMessage(actor.id, '10');
		const day = '2026-11-11';
		await expect(service.claim(actor, 'daily_message_test', day, 'claim-deleted')).rejects.toMatchObject({
			code: 'MISSION_INCOMPLETE',
		});
		now = new Date('2026-11-11T12:01:00Z');
		expect(await service.recordEvent(actor.id, 'message:12', 'message', 1, 'first')).toBe(false);
		expect(await service.recordEvent(actor.id, 'message:13', 'message', 1, 'second')).toBe(true);
		const results = await Promise.allSettled([
			service.claim(actor, 'daily_message_test', day, 'claim-first'),
			service.claim(actor, 'daily_message_test', day, 'claim-second'),
		]);
		expect(results.filter(({status}) => status === 'fulfilled')).toHaveLength(1);
		expect(await service.wallet(actor.id)).toMatchObject({balance: 20, reward_today: 20});
		now = new Date('2026-11-12T00:00:00Z');
		expect((await service.missions(actor)).find((mission) => mission.id === 'daily_message_test')).toMatchObject({
			progress: 0,
			claimed: false,
		});
	});
	it('seeds the supplied catalog and keeps unverifiable voice missions disabled', async () => {
		expect((await service.catalog()).filter((item) => item.collection_id === 'relay_origins')).toHaveLength(12);
		expect((await service.missionDefinitions()).filter((mission) => mission.event === 'voice')).toMatchObject([
			{enabled: false},
			{enabled: false},
		]);
	});

	it('enforces the daily cap across different missions and resets at UTC midnight', async () => {
		const actor = {id: '107', premium: false};
		await service.setRewardCap('900', 30, 'Test daily reward cap');
		now = new Date('2026-11-12T23:59:00Z');
		expect(await service.recordEvent(actor.id, 'login:2026-11-12', 'login')).toBe(true);
		expect(await service.recordEvent(actor.id, 'login:2026-11-12', 'login')).toBe(false);
		await service.claim(actor, 'daily_login', '2026-11-12', 'claim-day-1');
		await service.recordEvent(actor.id, 'message:99', 'message', 1, 'message-99');
		await expect(service.claim(actor, 'daily_message_test', '2026-11-12', 'claim-cap-1')).rejects.toMatchObject({
			code: 'DAILY_REWARD_LIMIT',
		});
		now = new Date('2026-11-13T00:00:00Z');
		await service.recordEvent(actor.id, 'login:2026-11-13', 'login');
		await service.claim(actor, 'daily_login', '2026-11-13', 'claim-day-2');
		expect(await service.wallet(actor.id)).toMatchObject({balance: 50, reward_today: 25, earned: '50'});
	});
	it('checks current sale price and verifies the message still exists before awarding RP', async () => {
		const actor = {id: '108', premium: false};
		now = new Date('2026-11-13T12:00:00Z');
		await addItem('changed_price', 75);
		await service.adjust('900', actor.id, 100, 'Test opening balance', 'grant-108');
		await expect(service.purchase(actor, 'changed_price', 'price-guard', 50)).rejects.toMatchObject({
			code: 'PRICE_CHANGED',
		});
		expect((await service.wallet(actor.id)).balance).toBe(100);
		expect(await service.inventory(actor)).toHaveLength(0);

		await service.recordEvent(actor.id, 'message:15:18', 'message', 1, 'credited-message');
		await expect(
			service.claim(actor, 'daily_message_test', '2026-11-13', 'verify-message', async () => false),
		).rejects.toMatchObject({code: 'MISSION_INCOMPLETE'});
		expect((await service.wallet(actor.id)).balance).toBe(100);
	});

	it('attests only the selected campaign and deduplicates event IDs', async () => {
		const actor = {id: '109', premium: false};
		now = new Date('2026-11-13T12:00:00Z');
		const definition = {
			id: 'campaign_one',
			name: 'Campaign',
			description: '',
			event: 'campaign',
			period: 'event',
			target: 1,
			reward: 25,
			premium: false,
			premium_bonus: 0,
			enabled: true,
			starts_at: new Date('2026-11-12T00:00:00Z'),
			ends_at: new Date('2026-11-15T00:00:00Z'),
			version: 1,
		};
		await service.saveMission('900', definition, 'Test campaign setup');
		await service.saveMission('900', {...definition, id: 'campaign_two'}, 'Test second campaign setup');
		expect(await service.attest('900', actor.id, 'campaign_one', 'first_event', 'Test verified attendance')).toBe(true);
		expect(await service.attest('900', actor.id, 'campaign_one', 'first_event', 'Test verified attendance')).toBe(
			false,
		);
		const campaigns = (await service.missions(actor)).filter((mission) => mission.event === 'campaign');
		expect(campaigns).toMatchObject([
			{id: 'campaign_one', progress: 1},
			{id: 'campaign_two', progress: 0},
		]);
		await service.claim(actor, 'campaign_one', definition.starts_at.toISOString(), 'campaign-reward');
		expect((await service.wallet(actor.id)).balance).toBe(25);
	});
	it('shares one equip slot between static and animated banners', async () => {
		const actor = {id: '110', premium: false};
		for (const category of ['banner', 'animated_banner']) {
			await service.saveCosmetic(
				'900',
				{
					...INITIAL_COSMETICS[0],
					id: `slot_${category}`,
					category,
					price: 0,
					premium: false,
					collection_id: null,
				},
				'Test banner slot',
			);
			await service.purchase(actor, `slot_${category}`, `slot-buy-${category}`);
		}
		await service.equip(actor, 'banner', 'slot_banner');
		await service.equip(actor, 'animated_banner', 'slot_animated_banner');
		expect(await service.active(actor)).toMatchObject([{id: 'slot_animated_banner'}]);
		await service.equip(actor, 'banner', null);
		expect(await service.active(actor)).toEqual([]);
	});
});
