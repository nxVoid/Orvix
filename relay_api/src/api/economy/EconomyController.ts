// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createMessageID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {requireAdminACL} from '@app/api/middleware/AdminMiddleware';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {isProfileHidden} from '@app/api/user/ProfileVisibility';
import {isDeletionComplete} from '@app/api/user/UserHelpers';
import {Validator} from '@app/api/Validator';
import {AdminACLs} from '@relay/constants/src/AdminACLs';
import type {Context} from 'hono';
import {z} from 'zod';
import {ECONOMY_ASSETS} from './EconomyAssets';
import {EconomyError, meaningfulMessage} from './EconomyPolicy';
import {getEconomy} from './EconomyRuntime';
import type {EconomyService} from './EconomyService';
import {notifyEconomyUpdate} from './EconomyUpdates';
import {economyStorageKey, uploadEconomyImage, uploadedAssetName} from './EconomyUploads';
import {STUDIO_ASSETS} from './StudioAssetRegistry';

const identifier = z.string().regex(/^[a-z0-9_]{1,64}$/u);
const userId = z.string().regex(/^[0-9]{1,20}$/u);
const ledgerId = z
	.string()
	.regex(/^[0-9]{1,19}$/u)
	.refine((value) => BigInt(value) <= 9223372036854775807n);
const key = z.string().regex(/^[a-zA-Z0-9:_-]{8,128}$/u);
const reason = z.string().trim().min(5).max(1000);
const category = z.enum([
	'avatar_frame',
	'banner',
	'animated_banner',
	'profile_theme',
	'nameplate',
	'name_color',
	'profile_background',
	'profile_effect',
	'badge',
	'premium_collection',
]);
const asset = z
	.string()
	.refine(
		(path) =>
			path.startsWith('/economy/assets/') &&
			(Object.hasOwn(STUDIO_ASSETS, path.slice('/economy/assets/'.length)) ||
				Object.hasOwn(ECONOMY_ASSETS, path.slice('/economy/assets/'.length)) ||
				uploadedAssetName.test(path.slice('/economy/assets/'.length))),
	);
const dates = {
	starts_at: z.iso
		.datetime({offset: true})
		.nullable()
		.transform((value) => (value ? new Date(value) : null)),
	ends_at: z.iso
		.datetime({offset: true})
		.nullable()
		.transform((value) => (value ? new Date(value) : null)),
};
const itemSchema = z.object({
	id: identifier,
	name: z.string().trim().min(1).max(100),
	description: z.string().max(1000),
	category,
	rarity: z.enum(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']),
	price: z.number().int().min(0).max(1_000_000_000),
	asset,
	static_asset: asset,
	animated: z.boolean(),
	premium: z.boolean(),
	published: z.boolean(),
	stock: z.number().int().min(0).max(1_000_000_000).nullable(),
	collection_id: identifier.nullable().optional(),
	event_label: z.string().max(100).nullable(),
	...dates,
	reason,
});
const missionSchema = z.object({
	id: identifier,
	name: z.string().trim().min(1).max(100),
	description: z.string().max(1000),
	event: z.enum(['login', 'message', 'voice', 'community', 'campaign']),
	period: z.enum(['daily', 'weekly', 'event']),
	target: z.number().int().min(1).max(1_000_000),
	reward: z.number().int().min(1).max(10_000),
	premium: z.boolean(),
	premium_bonus: z.number().int().min(0).max(10_000),
	enabled: z.boolean(),
	...dates,
	reason,
});

const readLimit = RateLimitMiddleware({bucket: 'economy:read', config: {limit: 120, windowMs: 60_000}});
const writeLimit = RateLimitMiddleware({bucket: 'economy:write', config: {limit: 20, windowMs: 60_000}});
const adminLimit = RateLimitMiddleware({bucket: 'economy:admin', config: {limit: 60, windowMs: 60_000}});
const assetLimit = RateLimitMiddleware({bucket: 'economy:assets', config: {limit: 240, windowMs: 60_000}});
const read = [LoginRequired, DefaultUserOnly, readLimit] as const;
const write = [LoginRequired, DefaultUserOnly, writeLimit] as const;

function actor(ctx: Context<HonoEnv>) {
	const user = ctx.get('user');
	if (user.isSystem || isDeletionComplete(user) || isProfileHidden(user))
		throw new EconomyError('ECONOMY_ACCESS_DENIED', 403);
	return {id: String(user.id), premium: user.isPremium()};
}

async function respond<T>(ctx: Context<HonoEnv>, fn: (economy: EconomyService) => Promise<T>) {
	ctx.header('Cache-Control', 'private, no-store');
	try {
		const result = await fn(await getEconomy());
		return ctx.json(result);
	} catch (error) {
		if (error instanceof EconomyError) return ctx.json({code: error.code, message: error.code}, error.status);
		throw error;
	}
}

async function requireTarget(ctx: Context<HonoEnv>, id: string) {
	const user = await ctx.get('userRepository').findUnique(createUserID(BigInt(id)));
	if (!user || user.isBot || user.isSystem || isDeletionComplete(user)) throw new EconomyError('USER_NOT_FOUND', 404);
	return user;
}

function validateWindow(starts: Date | null, ends: Date | null, required = false) {
	if ((required && (!starts || !ends)) || (starts && ends && starts >= ends)) {
		throw new EconomyError('INVALID_SALE_WINDOW', 400);
	}
}

export function EconomyController(app: HonoApp) {
	app.get('/economy/assets/:file', assetLimit, async (ctx) => {
		const file = ctx.req.param('file');
		if (Object.hasOwn(STUDIO_ASSETS, file)) {
			const asset = STUDIO_ASSETS[file];
			return ctx.body(Uint8Array.from(Buffer.from(asset.data, 'base64')), 200, {
				'Content-Type': asset.mime,
				'Content-Security-Policy': "default-src 'none'; img-src data:; sandbox",
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'public, max-age=3600',
			});
		}
		if (uploadedAssetName.test(file)) {
			const storage = ctx.get('storageService');
			const bucket = Config.s3.buckets.cdn;
			const key = economyStorageKey(file);
			const metadata = await storage.getObjectMetadata(bucket, key);
			if (metadata?.contentType !== 'image/webp' || metadata.contentLength > 512 * 1024) return ctx.notFound();
			const bytes = await storage.readObject(bucket, key, 512 * 1024);
			return ctx.body(Uint8Array.from(bytes), 200, {
				'Content-Type': 'image/webp',
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'public, max-age=31536000, immutable',
			});
		}
		if (!Object.hasOwn(ECONOMY_ASSETS, file)) return ctx.notFound();
		return ctx.body(ECONOMY_ASSETS[file], 200, {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=3600',
		});
	});
	app.get('/economy/wallet', ...read, (ctx) => respond(ctx, async (economy) => economy.wallet(actor(ctx).id)));
	app.get('/economy/history', ...read, Validator('query', z.object({before: ledgerId.optional()})), (ctx) =>
		respond(ctx, async (economy) => economy.history(actor(ctx).id, ctx.req.valid('query').before)),
	);
	app.get('/economy/catalog', ...read, (ctx) =>
		respond(ctx, async (economy) => {
			const account = actor(ctx);
			return {items: await economy.catalog(), premium: account.premium};
		}),
	);
	app.get('/economy/inventory', ...read, (ctx) =>
		respond(ctx, async (economy) => ({items: await economy.inventory(actor(ctx))})),
	);
	app.post(
		'/economy/public-cosmetics',
		...read,
		Validator('json', z.object({user_ids: z.array(userId).min(1).max(32)})),
		(ctx) =>
			respond(ctx, async (economy) => {
				actor(ctx);
				const candidates = await economy.publicCandidates(ctx.req.valid('json').user_ids);
				const ids = [...new Set(candidates.map((item) => item.user_id))];
				const users = await Promise.all(
					ids.map(async (id) => [id, await ctx.get('userRepository').findUnique(createUserID(BigInt(id)))] as const),
				);
				const byId = new Map(users);
				return {
					items: candidates.flatMap((item) => {
						const user = byId.get(item.user_id);
						return user && !isDeletionComplete(user) && !isProfileHidden(user) && (!item.premium || user.isPremium())
							? [
									{
										user_id: item.user_id,
										id: item.id,
										category: item.category,
										asset: item.asset,
										static_asset: item.static_asset,
									},
								]
							: [];
					}),
				};
			}),
	);
	app.post(
		'/economy/purchase',
		...write,
		Validator(
			'json',
			z.object({cosmetic_id: identifier, expected_price: z.number().int().min(0).max(1_000_000_000), key}).strict(),
		),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				const account = actor(ctx);
				const receipt = await economy.purchase(account, body.cosmetic_id, body.key, body.expected_price);
				notifyEconomyUpdate(account.id);
				return receipt;
			}),
	);
	app.put(
		'/economy/equipped',
		...write,
		Validator('json', z.object({category, cosmetic_id: identifier.nullable()}).strict()),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				const account = actor(ctx);
				await economy.equip(account, body.category, body.cosmetic_id);
				notifyEconomyUpdate(account.id);
				return {ok: true};
			}),
	);
	app.get('/economy/missions', ...read, (ctx) =>
		respond(ctx, async (economy) => ({missions: await economy.missions(actor(ctx))})),
	);
	app.get('/economy/mission-history', ...read, (ctx) =>
		respond(ctx, async (economy) => ({claims: await economy.missionHistory(actor(ctx).id)})),
	);
	app.post(
		'/economy/claim',
		...write,
		Validator('json', z.object({mission_id: identifier, period_key: z.string().min(10).max(40), key}).strict()),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				const account = actor(ctx);
				const receipt = await economy.claim(
					account,
					body.mission_id,
					body.period_key,
					body.key,
					async (eventId, hash) => {
						const match = /^message:([0-9]+):([0-9]+)$/u.exec(eventId);
						if (!match) return false;
						const message = await ctx
							.get('channelRepository')
							.messages.getMessage(createChannelID(BigInt(match[1])), createMessageID(BigInt(match[2])));
						return Boolean(
							message?.content &&
								String(message.authorId) === account.id &&
								meaningfulMessage(message.content) === hash,
						);
					},
				);
				notifyEconomyUpdate(account.id);
				return receipt;
			}),
	);

	app.get('/admin/economy', adminLimit, requireAdminACL(AdminACLs.ECONOMY_READ), (ctx) =>
		respond(ctx, async (economy) => ({
			items: await economy.catalog(true),
			missions: await economy.missionDefinitions(),
			...(await economy.statistics()),
		})),
	);
	app.get(
		'/admin/economy/users/:user_id',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_READ),
		Validator('param', z.object({user_id: userId})),
		Validator('query', z.object({before: ledgerId.optional()})),
		(ctx) =>
			respond(ctx, async (economy) => {
				const id = ctx.req.valid('param').user_id;
				const user = await requireTarget(ctx, id);
				const [wallet, inventory, history, claims] = await Promise.all([
					economy.wallet(id),
					economy.inventory({id, premium: user.isPremium()}),
					economy.history(id, ctx.req.valid('query').before),
					economy.missionHistory(id),
				]);
				return {wallet, inventory, history, claims};
			}),
	);
	app.post(
		'/admin/economy/assets',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_CATALOG),
		Validator('json', z.object({image: z.string().max(700_000), reason})),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				const path = await uploadEconomyImage(ctx.get('storageService'), body.image);
				await economy.recordAssetUpload(String(ctx.get('adminUserId')), path, body.reason);
				return {asset: path, static_asset: path};
			}),
	);
	app.put(
		'/admin/economy/settings',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_ADJUST),
		Validator('json', z.object({daily_reward_cap: z.number().int().min(0).max(1_000_000), reason})),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				await economy.setRewardCap(String(ctx.get('adminUserId')), body.daily_reward_cap, body.reason);
				return {ok: true};
			}),
	);
	app.post(
		'/admin/economy/attest',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_MISSIONS),
		Validator('json', z.object({user_id: userId, mission_id: identifier, event_id: identifier, reason})),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				const user = await requireTarget(ctx, body.user_id);
				if (isProfileHidden(user)) throw new EconomyError('ECONOMY_ACCESS_DENIED', 403);
				const recorded = await economy.attest(
					String(ctx.get('adminUserId')),
					body.user_id,
					body.mission_id,
					body.event_id,
					body.reason,
				);
				if (recorded) notifyEconomyUpdate(body.user_id);
				return {recorded};
			}),
	);
	app.put(
		'/admin/economy/catalog',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_CATALOG),
		Validator('json', itemSchema),
		(ctx) =>
			respond(ctx, async (economy) => {
				const {reason, ...item} = ctx.req.valid('json');
				validateWindow(item.starts_at, item.ends_at);
				for (const path of new Set([item.asset, item.static_asset])) {
					const file = path.slice('/economy/assets/'.length);
					if (
						uploadedAssetName.test(file) &&
						!(await ctx.get('storageService').getObjectMetadata(Config.s3.buckets.cdn, economyStorageKey(file)))
					) {
						throw new EconomyError('ASSET_NOT_FOUND', 404);
					}
				}
				if (item.static_asset.endsWith('.svg') && !item.static_asset.endsWith('-static.svg')) {
					throw new EconomyError('STATIC_ASSET_REQUIRED', 400);
				}
				await economy.saveCosmetic(
					String(ctx.get('adminUserId')),
					{...item, sold: 0, collection_id: item.collection_id ?? null},
					reason,
				);
				return {ok: true};
			}),
	);
	app.put(
		'/admin/economy/missions',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_MISSIONS),
		Validator('json', missionSchema),
		(ctx) =>
			respond(ctx, async (economy) => {
				const {reason, ...mission} = ctx.req.valid('json');
				validateWindow(mission.starts_at, mission.ends_at, mission.period === 'event');
				if (mission.event === 'message' && mission.target > 100) throw new EconomyError('INVALID_MISSION_TARGET', 400);
				if (mission.event === 'voice' && mission.enabled) throw new EconomyError('VOICE_ACTIVITY_UNAVAILABLE', 409);
				await economy.saveMission(String(ctx.get('adminUserId')), {...mission, version: 1}, reason);
				return {ok: true};
			}),
	);
	app.post(
		'/admin/economy/adjust',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_ADJUST),
		Validator(
			'json',
			z
				.object({user_id: userId, amount: z.number().int().min(-1_000_000_000).max(1_000_000_000), reason, key})
				.strict(),
		),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				await requireTarget(ctx, body.user_id);
				const receipt = await economy.adjust(
					String(ctx.get('adminUserId')),
					body.user_id,
					body.amount,
					body.reason,
					body.key,
				);
				notifyEconomyUpdate(body.user_id);
				return receipt;
			}),
	);
	app.post(
		'/admin/economy/refund',
		adminLimit,
		requireAdminACL(AdminACLs.ECONOMY_ADJUST),
		Validator('json', z.object({user_id: userId, transaction_id: ledgerId, reason, key}).strict()),
		(ctx) =>
			respond(ctx, async (economy) => {
				const body = ctx.req.valid('json');
				await requireTarget(ctx, body.user_id);
				const receipt = await economy.refund(
					String(ctx.get('adminUserId')),
					body.user_id,
					body.transaction_id,
					body.reason,
					body.key,
				);
				notifyEconomyUpdate(body.user_id, true);
				return receipt;
			}),
	);
}
