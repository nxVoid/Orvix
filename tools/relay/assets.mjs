import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {hash, root, snapshot, write} from './workspace.mjs';

const require = createRequire(path.join(root, 'relay_api/package.json'));
const sharp = require('sharp');
const source = fs.readFileSync(path.join(root, 'branding/relay-logo.png'));
const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha) throw new Error('Source logo must have alpha');
const outputs = [];
const save = (name, data) => {
	if (name.endsWith('.svg')) {
		const old = path.join(snapshot, 'files', name);
		const notices = fs.existsSync(old)
			? (fs.readFileSync(old, 'utf8').match(/<!--[\s\S]*?-->/g) ?? []).filter((c) => /SPDX|copyright/i.test(c))
			: [];
		if (notices.length) data = `${notices.join('\n')}\n${data}`;
	}
	write(name, data);
	outputs.push(name);
};
async function icon(size, opaque = false) {
	const art = await sharp(source)
		.resize(Math.round(size * 0.9), Math.round(size * 0.9), {fit: 'inside'})
		.png()
		.toBuffer();
	const background = opaque ? {r: 69, g: 53, b: 190, alpha: 1} : {r: 0, g: 0, b: 0, alpha: 0};
	return sharp({create: {width: size, height: size, channels: 4, background}})
		.composite([{input: art, gravity: 'centre'}])
		.png()
		.toBuffer();
}
const ico = async () => {
	const sizes = [16, 24, 32, 48, 64, 128, 256],
		parts = await Promise.all(sizes.map((n) => icon(n)));
	const header = Buffer.alloc(6 + 16 * sizes.length);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(sizes.length, 4);
	let offset = header.length;
	sizes.forEach((n, i) => {
		const pos = 6 + 16 * i;
		header[pos] = n === 256 ? 0 : n;
		header[pos + 1] = header[pos];
		header.writeUInt16LE(1, pos + 4);
		header.writeUInt16LE(32, pos + 6);
		header.writeUInt32LE(parts[i].length, pos + 8);
		header.writeUInt32LE(offset, pos + 12);
		offset += parts[i].length;
	});
	return Buffer.concat([header, ...parts]);
};
const icns = async () => {
	const chunks = [];
	for (const [type, size] of [
		['ic07', 128],
		['ic08', 256],
		['ic09', 512],
		['ic10', 1024],
	]) {
		const data = await icon(size, true),
			h = Buffer.alloc(8);
		h.write(type);
		h.writeUInt32BE(data.length + 8, 4);
		chunks.push(h, data);
	}
	const head = Buffer.alloc(8);
	head.write('icns');
	head.writeUInt32BE(8 + chunks.reduce((n, b) => n + b.length, 0), 4);
	return Buffer.concat([head, ...chunks]);
};
const mark = await icon(512),
	embedded = mark.toString('base64');
const svgMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Relay"><image width="512" height="512" href="data:image/png;base64,${embedded}"/></svg>\n`;
const wordmark = (color = 'currentColor') =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 200" role="img" aria-label="relay"><text x="12" y="153" fill="${color}" font-family="Inter,Arial,sans-serif" font-size="180" font-weight="700" letter-spacing="-8">relay</text></svg>\n`;
save('branding/generated/relay-symbol.png', mark);
save('branding/generated/relay-symbol.svg', svgMark);
save('branding/generated/relay-wordmark.svg', wordmark());
for (const name of [
	'relay_app/src/media/images/relay-logo-color.svg',
	'relay_admin/static/relay-logo-color.svg',
	'relay_static/marketing/branding/symbol-white.svg',
	'relay_desktop/src/splash/symbol.svg',
])
	save(name, svgMark);
for (const name of [
	'relay_app/src/media/images/relay-wordmark.svg',
	'relay_app/src/media/images/relay-logo-wordmark-monochrome.svg',
	'relay_admin/static/relay-wordmark.svg',
])
	save(name, wordmark());
for (const [name, color] of [
	['logo-color.svg', '#6855ef'],
	['logo-white.svg', '#ffffff'],
])
	save(`relay_static/marketing/branding/${name}`, wordmark(color));
for (const [name, size, opaque] of [
	['favicon-16x16.png', 16],
	['favicon-32x32.png', 32],
	['android-chrome-192x192.png', 192],
	['android-chrome-512x512.png', 512],
	['apple-touch-icon.png', 180, true],
	['mstile-150x150.png', 150, true],
	['maskable-512x512.png', 512, true],
])
	save(`relay_static/web/${name}`, await icon(size, opaque));
const windowsIcon = await ico(),
	macIcon = await icns();
save('relay_static/web/favicon.ico', windowsIcon);
for (const channel of ['stable', 'canary', 'development']) {
	const dir = `relay_desktop/build_resources/icons-${channel}`;
	for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) save(`${dir}/${size}x${size}.png`, await icon(size));
	save(`${dir}/icon.png`, await icon(1024));
	save(`${dir}/icon.ico`, windowsIcon);
	save(`${dir}/_compiled/AppIcon.icns`, macIcon);
	save(`${dir}/AppIcon.icon/Assets/Vector.svg`, svgMark);
	for (const [suffix, size] of [
		['', 22],
		['@2x', 44],
	]) {
		const alpha = await sharp(await icon(size))
			.extractChannel('alpha')
			.toBuffer();
		const tray = await sharp({create: {width: size, height: size, channels: 3, background: '#000000'}})
			.joinChannel(alpha)
			.png()
			.toBuffer();
		save(`${dir}/RelayTrayTemplate${suffix}.png`, tray);
	}
}
for (const name of ['logo-color.png', 'logo-white.png']) save(`relay_static/email/brand/v1/${name}`, await icon(128));
const gradient = Buffer.from(
	'<svg width="1200" height="630"><defs><linearGradient id="g"><stop stop-color="#151125"/><stop offset="1" stop-color="#343485"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><text x="565" y="285" fill="white" font-family="Arial,sans-serif" font-size="96" font-weight="700">relay</text><text x="570" y="355" fill="#d7d9ff" font-family="Arial,sans-serif" font-size="30">Your people. Your place.</text></svg>',
);
save(
	'relay_static/web/relay-social.png',
	await sharp(gradient)
		.composite([{input: await icon(400), left: 100, top: 110}])
		.png()
		.toBuffer(),
);
save(
	'branding/generated/manifest.json',
	`${JSON.stringify({source: 'branding/relay-logo.png', sourceSha256: hash(source), sourceWidth: metadata.width, sourceHeight: metadata.height, hasAlpha: metadata.hasAlpha, outputs}, null, 2)}\n`,
);
console.log(
	JSON.stringify({
		assets: outputs.length,
		sourceUnchanged: hash(fs.readFileSync(path.join(root, 'branding/relay-logo.png'))) === hash(source),
	}),
);
