// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const COMMIT = '0128ca510d653bb04d6d1e4885bd8890b5050b4f';
const BASE_URL = `https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/${COMMIT}/public/glb`;

const ENV_ASSETS = [
	{
		file: 'furniture-chair-office.glb',
		source: `${BASE_URL}/house_interior_pack/Chair_1.glb`,
	},
	{
		file: 'furniture-chair-lounge.glb',
		source: `${BASE_URL}/house_interior_pack/Chair_2.glb`,
	},
	{
		file: 'furniture-sofa.glb',
		source: `${BASE_URL}/house_interior_pack/Couch_Large1.glb`,
	},
	{
		file: 'furniture-table-large.glb',
		source: `${BASE_URL}/house_interior_pack/Table_RoundLarge.glb`,
	},
	{
		file: 'furniture-plant.glb',
		source: `${BASE_URL}/house_interior_pack/Houseplant_1.glb`,
	},
	{
		file: 'furniture-bookshelf.glb',
		source: `${BASE_URL}/house_interior_pack/Bookshelf.glb`,
	},
	{
		file: 'furniture-lamp.glb',
		source: `${BASE_URL}/house_interior_pack/Light_Floor1.glb`,
	},
	{
		file: 'skyline-building.glb',
		source: `${BASE_URL}/buildings_pack_2/Building3_Big.glb`,
	},
];

async function main() {
	const outDir = path.resolve('relay_app/src/features/rooms3d/assets/environments');
	fs.mkdirSync(outDir, {recursive: true});

	for (const asset of ENV_ASSETS) {
		console.log(`Fetching ${asset.file}...`);
		const res = await fetch(asset.source);
		if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${asset.source}`);
		const ab = await res.arrayBuffer();
		const dest = path.join(outDir, asset.file);
		fs.writeFileSync(dest, Buffer.from(ab));
		console.log(`Saved ${asset.file}: ${ab.byteLength} bytes.`);
	}
	console.log('Environment assets prepared successfully.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
