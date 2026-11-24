// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const directory = new URL('../../../relay_app/src/features/rooms3d/assets/environments/', import.meta.url);
const provenance = JSON.parse(readFileSync(new URL('environment-provenance.json', directory), 'utf8')) as Array<{
	file: string;
	sha256: string;
	license: string;
	bytes: number;
	source: string;
}>;

describe('approved licensed 3D environment assets', () => {
	for (const entry of provenance)
		it(`${entry.file} is pinned, bounded, self-contained binary glTF`, () => {
			const data = readFileSync(new URL(entry.file, directory));
			expect(data.toString('ascii', 0, 4)).toBe('glTF');
			expect(data.length).toBe(entry.bytes);
			expect(data.length).toBeLessThan(1 * 1024 * 1024); // all under 1MB
			expect(createHash('sha256').update(data).digest('hex')).toBe(entry.sha256);
			expect(entry.source).toMatch(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//u);
			expect(entry.license).toMatch(/CC0-1.0/u);
			const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()) as {
				nodes?: Array<unknown>;
				meshes?: Array<unknown>;
				buffers: Array<{uri?: string}>;
				images?: Array<{uri?: string}>;
			};
			expect(gltf.buffers.every((b) => !b.uri)).toBe(true);
			expect((gltf.images ?? []).every((b) => !b.uri)).toBe(true);
			expect(gltf.meshes?.length).toBeGreaterThan(0);
		});
});
