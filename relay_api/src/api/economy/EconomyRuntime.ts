// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import {Config} from '@app/api/Config';
import {getDefaultPostgresClient, type IPostgresClient} from '@pkgs/postgres/src/Client';
import {INITIAL_COSMETICS} from './EconomyCatalog';
import {economySchemaName, migrateEconomy} from './EconomyMigration';
import {EconomyError} from './EconomyPolicy';
import {EconomyService} from './EconomyService';
import {STUDIO_PRODUCTS, STUDIO_UPGRADES} from './StudioAssetRegistry';

let initialization: Promise<EconomyService> | undefined;
export function getEconomy(): Promise<EconomyService> {
	if (Config.database.backend !== 'postgres') return Promise.reject(new EconomyError('ECONOMY_UNAVAILABLE', 503));
	if (!initialization) {
		const client = getDefaultPostgresClient();
		const kvTable = client.kvTable();
		const schema =
			kvTable === 'orvix_kv'
				? 'relay_economy'
				: `relay_economy_instance_${createHash('sha256').update(kvTable).digest('hex').slice(0, 16)}`;
		initialization = initializeEconomy(client, schema).catch((error) => {
			initialization = undefined;
			throw error;
		});
	}
	return initialization;
}
export async function initializeEconomy(client: IPostgresClient, schema = 'relay_economy') {
	const tables = economySchemaName(schema);
	await migrateEconomy(client, schema);
	const service = new EconomyService(client, schema);
	await client.transaction(async (db) => {
		await db.query(
			`INSERT INTO ${tables}.collections(id,name,description) VALUES('relay_origins','Relay Origins','Özgün mor Relay koleksiyonu') ON CONFLICT DO NOTHING`,
		);
		for (const c of INITIAL_COSMETICS) {
			await db.query(
				`INSERT INTO ${tables}.catalog(id,name,description,category,rarity,price,asset,static_asset,animated,premium,published,collection_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
				[
					c.id,
					c.name,
					c.description,
					c.category,
					c.rarity,
					c.price,
					c.asset,
					c.static_asset,
					c.animated,
					c.premium,
					c.published,
					c.collection_id,
				],
			);
		}
		await db.query(
			`INSERT INTO ${tables}.collections(id,name,description)
			VALUES('relay_gallery','Relay Gallery','Relay referans koleksiyonu') ON CONFLICT DO NOTHING`,
		);
		for (const product of STUDIO_PRODUCTS) {
			await db.query(
				`INSERT INTO ${tables}.catalog
				(id,name,description,category,rarity,price,asset,static_asset,animated,premium,published,collection_id)
				VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11) ON CONFLICT DO NOTHING`,
				[product.id, product.name, 'Relay Gallery koleksiyonu', product.category, product.rarity,
				 product.price, product.asset, product.static_asset, product.animated, product.premium, product.collection_id],
			);
		}

		for (const product of STUDIO_UPGRADES) {
			await db.query(
				`UPDATE ${tables}.catalog SET asset=$2,static_asset=$3,animated=true,updated_at=now()
				WHERE id=$1 AND collection_id='relay_origins'
				AND asset=$4 AND static_asset=$5`,
				[
					product.id,
					product.asset,
					product.static_asset,
					`/economy/assets/${product.id}.svg`,
					`/economy/assets/${product.id}-static.svg`,
				],
			);
		}

		for (const m of [
			['daily_login', 'Günlük giriş', 'login', 'daily', 1, 25],
			['daily_messages', '5 anlamlı mesaj', 'message', 'daily', 5, 20],
			['daily_voice', '10 dakika aktif ses', 'voice', 'daily', 600, 30],
			['weekly_login', 'Haftada 5 gün giriş', 'login', 'weekly', 5, 100],
			['weekly_voice', 'Haftalık 120 dakika aktif ses', 'voice', 'weekly', 7200, 150],
		])
			await db.query(
				`INSERT INTO ${tables}.missions(id,name,event,period,target,reward,enabled) VALUES($1,$2,$3,$4,$5,$6,$3 <> 'voice') ON CONFLICT DO NOTHING`,
				m,
			);
	});
	return service;
}
