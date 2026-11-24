// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const directory = new URL('../../../relay_app/src/features/rooms3d/assets/', import.meta.url);
const provenance = JSON.parse(readFileSync(new URL('avatar-provenance.json', directory), 'utf8')) as Array<{
	file: string;
	sha256: string;
	license: string;
	bytes: number;
	source: string;
}>;
describe('approved licensed avatar assets', () => {
	for (const entry of provenance)
		it(`${entry.file} is pinned, bounded, self-contained and has locomotion clips`, () => {
			const data = readFileSync(new URL(entry.file, directory));
			expect(data.toString('ascii', 0, 4)).toBe('glTF');
			expect(data.length).toBe(entry.bytes);
			expect(data.length).toBeLessThan(2 * 1024 * 1024);
			expect(createHash('sha256').update(data).digest('hex')).toBe(entry.sha256);
			expect(entry.source).toMatch(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//u);
			expect(entry.license).toMatch(/CC0-1.0/u);
			const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()) as {
				animations: Array<{name: string}>;
				skins: Array<unknown>;
				buffers: Array<{uri?: string}>;
				images?: Array<{uri?: string}>;
			};
			expect(gltf.skins.length).toBeGreaterThan(0);
			expect(gltf.buffers.every((b) => !b.uri)).toBe(true);
			expect((gltf.images ?? []).every((b) => !b.uri)).toBe(true);
			const names = gltf.animations.map((a) => a.name);
			const required =
				entry.file === 'fox.glb'
					? ['Survey', 'Walk', 'Run']
					: entry.file === 'robot-expressive.glb'
						? ['Idle', 'Walking', 'Running']
						: ['Idle', 'Walk', 'Run'];
			for (const name of required) expect(names).toContain(name);
		});
});
