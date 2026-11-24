// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';
import {Config} from '@app/api/Config';
import type {IStorageService} from '@app/api/infrastructure/IStorageService';
import sharp from 'sharp';
import {EconomyError} from './EconomyPolicy';

export const uploadedAssetName = /^[a-f0-9]{64}\.webp$/u;
const maximumBytes = 512 * 1024;
const maximumPixels = 2048 * 2048;

export function economyStorageKey(file: string) {
	return `relay-economy/${file}`;
}

/** Decode and re-encode uploads into a bounded, metadata-free static WebP. */
export async function uploadEconomyImage(storage: IStorageService, encoded: string): Promise<string> {
	if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) throw new EconomyError('INVALID_ASSET', 400);
	const bytes = Buffer.from(encoded, 'base64');
	if (bytes.length > maximumBytes) throw new EconomyError('ASSET_TOO_LARGE', 400);
	let output: Buffer;
	try {
		const image = sharp(bytes, {limitInputPixels: maximumPixels, failOn: 'error'});
		const metadata = await image.metadata();
		if (!['png', 'webp', 'jpeg'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
			throw new EconomyError('INVALID_ASSET', 400);
		}
		output = await image
			.rotate()
			.resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true})
			.webp({quality: 88})
			.toBuffer();
	} catch (error) {
		if (error instanceof EconomyError) throw error;
		throw new EconomyError('INVALID_ASSET', 400);
	}
	if (output.length > maximumBytes) throw new EconomyError('ASSET_TOO_LARGE', 400);
	const name = `${createHash('sha256').update(output).digest('hex')}.webp`;
	await storage.uploadObject({
		bucket: Config.s3.buckets.cdn,
		key: economyStorageKey(name),
		body: output,
		contentType: 'image/webp',
	});
	return `/economy/assets/${name}`;
}
