// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {AVATAR_MODELS, type AvatarModelId} from '../../../relay_app/src/features/rooms3d/AvatarCatalog';

const directory = new URL('../../../relay_app/src/features/rooms3d/assets/', import.meta.url);

describe('rig and animation tracks check for all 16 avatars', () => {
	for (const [id, model] of Object.entries(AVATAR_MODELS) as Array<[AvatarModelId, typeof AVATAR_MODELS[AvatarModelId]]>) {
		it(`validates ${id} skeleton bones and animation tracks`, () => {
			const filename = model.url.split('/').pop()!;
			const data = readFileSync(new URL(filename, directory));
			const jsonLen = data.readUInt32LE(12);
			const json = JSON.parse(data.subarray(20, 20 + jsonLen).toString()) as {
				nodes: Array<{name?: string}>;
				skins?: Array<{joints: Array<number>}>;
				animations: Array<{
					name: string;
					channels: Array<{target: {node: number; path: string}}>;
				}>;
			};

			expect(json.skins?.length).toBeGreaterThan(0);
			const jointNodeIndices = new Set(json.skins![0].joints);
			const boneNames = [...jointNodeIndices].map((idx) => json.nodes[idx].name).filter(Boolean);

			// Check clips
			const clipNames = json.animations.map((a) => a.name);
			for (const clipKey of ['idle', 'walk', 'run'] as const) {
				const expectedClip = model.clips[clipKey];
				expect(clipNames).toContain(expectedClip);

				const anim = json.animations.find((a) => a.name === expectedClip)!;
				expect(anim.channels.length).toBeGreaterThan(0);

				// Verify that animation targets actual bones in the skeleton
				const animatedJoints = anim.channels
					.map((c) => c.target.node)
					.filter((nodeIdx) => jointNodeIndices.has(nodeIdx));
				expect(animatedJoints.length).toBeGreaterThan(0);
			}
		});
	}
});
