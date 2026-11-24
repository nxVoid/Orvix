// SPDX-License-Identifier: AGPL-3.0-or-later
// Render bounded regions from the provided native SVG reference boards.
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'relay_api/package.json'));
const sharp = require('sharp');
const studio = path.join(root, 'docs/cosmetics-studio');
const references = path.join(root, 'docs/references/spark');
const bannerBoard = 'Neon Purple Cosmic Banner Collection-3.svg';
const frameBoard = 'Relay Avatar Frame Collection-2.svg';
const uiBoard = 'Relay Neon Cosmetics UI Board-1.svg';
const profileBoard = 'Neon Sci-Fi Profile Collection-4.svg';
const economyBoard = 'Relay Kozmetik Ekonomisi Tasarım Panosu.svg';
const products = [
	['gallery_nebula_spiral', 'Nebula Spiral', 'banner', bannerBoard, [54, 72, 976, 195], 1800],
	['gallery_violet_aurora', 'Violet Aurora', 'banner', bannerBoard, [54, 309, 976, 197], 1800],
	['gallery_lunar_eclipse', 'Lunar Eclipse', 'banner', bannerBoard, [54, 551, 976, 197], 2000],
	['gallery_quantum_landscape', 'Quantum Landscape', 'banner', bannerBoard, [54, 792, 976, 194], 1800],
	['gallery_midnight_planets', 'Midnight Planets', 'banner', bannerBoard, [54, 1034, 976, 194], 2000],
	['gallery_violet_halo', 'Violet Halo · Gallery', 'avatar_frame', frameBoard, [34, 296, 334, 334], 1100],
	['gallery_quantum_pulse', 'Quantum Pulse · Gallery', 'avatar_frame', frameBoard, [353, 297, 334, 334], 1400],
	['gallery_amethyst_crown', 'Amethyst Crown · Gallery', 'avatar_frame', frameBoard, [669, 295, 334, 334], 2400],
	['gallery_midnight_orbit', 'Midnight Orbit · Gallery', 'avatar_frame', frameBoard, [985, 297, 334, 334], 1600],
	['gallery_prism_core', 'Prism Core · Gallery', 'avatar_frame', frameBoard, [1300, 297, 334, 334], 2800],
	['gallery_eclipse_glass', 'Eclipse Glass', 'nameplate', uiBoard, [688, 486, 278, 36], 750],
	['gallery_crystal_edge', 'Crystal Edge', 'nameplate', uiBoard, [688, 544, 278, 36], 900],
	['gallery_orbit_line', 'Orbit Line', 'nameplate', uiBoard, [688, 590, 278, 32], 750],
	['gallery_lunar_citadel', 'Lunar Citadel', 'banner', profileBoard, [128, 158, 420, 87], 1600],
	['gallery_nebula_swell', 'Nebula Swell', 'banner', uiBoard, [807, 157, 372, 96], 1500],
	['gallery_obsidian_gateway', 'Obsidian Gateway', 'banner', economyBoard, [830, 70, 380, 165], 1800],
];
const categories = {banner: 'banners', avatar_frame: 'avatar-frames', nameplate: 'nameplates'};
const manifestPath = path.join(studio, 'manifests/collection-v2.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const [id, name, category, reference, crop, price] of products) {
	const [x, y, width, height] = crop;
	const svg = await readFile(path.join(references, reference), 'utf8');
	const viewBox = /viewBox="0 0 ([0-9]+) ([0-9]+)"/u.exec(svg);
	const originalPng = await readFile(path.join(references, reference.replace('.svg', '.png')));
	const body = `<image xmlns:xlink="http://www.w3.org/1999/xlink" width="${viewBox[1]}" height="${viewBox[2]}" xlink:href="data:image/png;base64,${originalPng.toString('base64')}"/>`;
	let mask = '';
	let start = '';
	let end = '';
	if (category === 'avatar_frame') {
		const center = width / 2;
		mask = `<defs><mask id="product-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="black"/><ellipse cx="${center}" cy="${center}" rx="162" ry="164" fill="white"/><circle cx="${center}" cy="${center}" r="119" fill="black"/><ellipse cx="${center}" cy="327" rx="160" ry="23" fill="black"/></mask><filter id="extract" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 0 1 0 -0.22"/></filter></defs>`;
		start = '<g mask="url(#product-mask)"><g filter="url(#extract)">';
		end = '</g></g>';
	}
	const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${mask}${start}<g transform="translate(${-x} ${-y})">${body}</g>${end}</svg>`;
	const folder = path.join(studio, 'assets', categories[category], id);
	const sourceFolder = path.join(studio, 'source', id);
	await mkdir(folder, {recursive: true});
	await mkdir(sourceFolder, {recursive: true});
	await writeFile(path.join(sourceFolder, 'extraction.json'), JSON.stringify({reference: 'docs/references/spark/' + reference, crop, mask: category === 'avatar_frame' ? {center: width / 2, outer: [162, 164], inner: 119} : null}, null, 2) + '\n');
	const outputSize = category === 'avatar_frame' ? 320 : Math.min(width, 960);
	const image = await sharp(Buffer.from(source)).resize({width: outputSize, withoutEnlargement: true}).webp({quality:90,alphaQuality:100}).toBuffer();
	const filename = id + '-v1-static.webp';
	await writeFile(path.join(folder, filename), image);
	const metadata = {
		id, name, version: 1, category, rarity: price >= 2000 ? 'Epic' : 'Rare', price_rp: price,
		premium: id === 'gallery_amethyst_crown' || id === 'gallery_prism_core',
		asset: filename, poster: filename, preview: filename, animated: false,
		protected_aperture_ratio: category === 'avatar_frame' ? 119/334 : null,
		sizes: category === 'avatar_frame' ? [32,40,64,96,128] : [[outputSize,Math.round(height*outputSize/width)]],
		budgets: {max_asset_bytes:160000,max_concurrent_animations:0,target_fps:0},
		motion: {duration_seconds:0,technique:'Static reference-vector extraction'},
		license:'User-provided Relay artwork; original source retained in docs/references/spark',
		source:'Original user-supplied PNG; SVG viewport composition and protected avatar aperture. Matching traced SVG is retained as reference.',
		quality_state:'reviewed', collection_id:'relay_gallery',
	};
	await writeFile(path.join(folder, 'metadata.json'), JSON.stringify(metadata,null,2)+'\n');
	if (!manifest.products.some(item=>item.id===id)) {
		manifest.products.push({id,directory:path.relative(studio,folder).replaceAll('\\','/')});
	}
}
await writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${products.length} reference products for visual review`);
