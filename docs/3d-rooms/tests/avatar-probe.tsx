// SPDX-License-Identifier: AGPL-3.0-or-later
// Runs the actual downloaded GLB animation clips and independent skin bindings in a browser.
import {useLoader} from '@react-three/fiber';
import {useEffect, useRef} from 'react';
import type {Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {AvatarAnimationPlayer} from '../../../relay_app/src/features/rooms3d/AvatarAnimationPlayer';
import {AVATAR_MODELS} from '../../../relay_app/src/features/rooms3d/AvatarCatalog';

function signature(root: Object3D) {
	const values: Array<number> = [];
	root.traverse((node) => {
		if (node.type === 'Bone') values.push(...node.quaternion.toArray(), ...node.position.toArray());
	});
	return values;
}
function differs(a: Array<number>, b: Array<number>) {
	return a.some((v, i) => Math.abs(v - b[i]) > 0.00001);
}
export function AvatarProbe({onResult}: {onResult: (result: unknown) => void}) {
	const notify = useRef(onResult);
	notify.current = onResult;
	const models = useLoader(GLTFLoader, [AVATAR_MODELS.robot.url, AVATAR_MODELS.fox.url]);
	useEffect(() => {
		const results = models.map((gltf, i) => {
			const model = i === 0 ? AVATAR_MODELS.robot : AVATAR_MODELS.fox;
			const root = clone(gltf.scene),
				other = clone(gltf.scene),
				untouched = signature(other);
			const player = new AvatarAnimationPlayer(root, gltf.animations, model.clips);
			const advance = (mode: 'idle' | 'walk' | 'run', reduced: boolean) => {
				for (let n = 0; n < 12; n++) player.update(mode, 1 / 30, reduced);
			};
			advance('walk', false);
			const walk = signature(root);
			advance('walk', false);
			const walkMovesBones = differs(walk, signature(root));
			advance('run', false);
			const run = signature(root);
			advance('run', false);
			const runMovesBones = differs(run, signature(root));
			advance('walk', true);
			const reduced = signature(root);
			advance('walk', true);
			const reducedWalkMoves = differs(reduced, signature(root));
			advance('idle', true);
			const idle = signature(root);
			advance('idle', true);
			const reducedIdleStill = !differs(idle, signature(root));
			const independentSkeleton = !differs(untouched, signature(other));
			player.dispose();
			return {
				model: i === 0 ? 'robot' : 'fox',
				bones: untouched.length / 7,
				clipsPresent: Object.values(model.clips).every((name) => gltf.animations.some((a) => a.name === name)),
				walkMovesBones,
				runMovesBones,
				reducedWalkMoves,
				reducedIdleStill,
				independentSkeleton,
			};
		});
		notify.current(results);
	}, [models]);
	return null;
}
