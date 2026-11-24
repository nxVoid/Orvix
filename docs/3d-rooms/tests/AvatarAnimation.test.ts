// SPDX-License-Identifier: AGPL-3.0-or-later
import {AnimationClip, Bone, Group, NumberKeyframeTrack} from 'three';
import {describe, expect, it} from 'vitest';
import {AvatarAnimationPlayer, localLocomotion} from '../../../relay_app/src/features/rooms3d/AvatarAnimationPlayer';

function fixture() {
	const root = new Group(),
		bone = new Bone();
	bone.name = 'leg';
	root.add(bone);
	const clips = ['Idle', 'Walking', 'Running'].map(
		(name, i) =>
			new AnimationClip(name, 1, [new NumberKeyframeTrack('leg.rotation[x]', [0, 0.5, 1], [0, (i + 1) * 0.2, 0])]),
	);
	return {bone, player: new AvatarAnimationPlayer(root, clips, {idle: 'Idle', walk: 'Walking', run: 'Running'})};
}
describe('avatar locomotion playback', () => {
	it('reacts immediately to local input and distinguishes walk/run/sit/emotes', () => {
		expect(localLocomotion({x: 0, z: 0, run: true})).toBe('idle');
		expect(localLocomotion({x: 0, z: 1, run: false})).toBe('walk');
		expect(localLocomotion({x: 0, z: 1, run: true})).toBe('run');
		expect(localLocomotion({x: 0, z: 0, run: false, sit: true})).toBe('sit');
		expect(localLocomotion({x: 1, z: 1, run: true, sit: true})).toBe('sit');
		expect(localLocomotion({x: 0, z: 0, run: false, emote: 'wave'})).toBe('wave');
		expect(localLocomotion({x: 0, z: 0, run: false, emote: 'dance'})).toBe('dance');
	});
	it('advances a held animation without resetting every update', () => {
		const {bone, player} = fixture();
		player.update('walk', 0.1, false);
		const first = bone.rotation.x;
		player.update('walk', 0.1, false);
		player.update('walk', 0.1, false);
		expect(bone.rotation.x).toBeGreaterThan(first);
		player.dispose();
	});
	it('keeps essential walking visible with reduced motion and freezes ambient idle', () => {
		const {bone, player} = fixture();
		player.update('walk', 0.1, true);
		const first = bone.rotation.x;
		player.update('walk', 0.1, true);
		expect(bone.rotation.x).not.toBe(first);
		player.update('idle', 0.1, true);
		const idle = bone.rotation.x;
		player.update('idle', 0.1, true);
		expect(bone.rotation.x).toBe(idle);
		player.dispose();
	});
	it('isolates animation state between participants and restores bindings on dispose', () => {
		const a = fixture(),
			b = fixture();
		a.player.update('run', 0.1, false);
		a.player.update('run', 0.1, false);
		expect(a.bone.rotation.x).not.toBe(b.bone.rotation.x);
		a.player.dispose();
		expect(a.bone.rotation.x).toBe(0);
		b.player.dispose();
	});
});
