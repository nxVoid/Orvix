// SPDX-License-Identifier: AGPL-3.0-or-later
import {useFrame, useLoader} from '@react-three/fiber';
import type {AvatarId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {type RefObject, useEffect, useMemo} from 'react';
import {Mesh, MeshStandardMaterial, SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {AvatarAnimationPlayer, type Locomotion, localLocomotion} from './AvatarAnimationPlayer';
import {AVATAR_MODELS, AVATAR_PRESETS} from './AvatarCatalog';
import {type AvatarMetrics, normalizeAvatarModel} from './AvatarNormalizer';

export function ApprovedAvatar({
	avatarId,
	animation,
	reduced,
	movement,
	firstPerson = false,
	onMetrics,
}: {
	avatarId: AvatarId;
	animation: Locomotion;
	reduced: boolean;
	movement?: RefObject<{x: number; z: number; run: boolean; sit?: boolean; emote?: 'wave' | 'dance'}>;
	firstPerson?: boolean;
	onMetrics?: (metrics: AvatarMetrics) => void;
}) {
	const preset = AVATAR_PRESETS[avatarId] ?? AVATAR_PRESETS.violet;
	const model = AVATAR_MODELS[preset.model];
	const gltf = useLoader(GLTFLoader, model.url);
	const {scene, materials, metrics} = useMemo(() => {
		// A normal Object3D.clone shares skin bindings; each participant must own independent bones.
		const scene = cloneSkeleton(gltf.scene);
		const owned: Array<MeshStandardMaterial> = [];
		scene.traverse((object) => {
			if (!(object instanceof Mesh)) return;
			object.castShadow = true;
			object.receiveShadow = true;
			const copy = (material: MeshStandardMaterial) => {
				const next = material.clone();
				if (preset.tint && (preset.model === 'fox' || next.name === 'Main')) next.color.set(preset.tint);
				owned.push(next);
				return next;
			};
			if (Array.isArray(object.material))
				object.material = object.material.map((m) => (m instanceof MeshStandardMaterial ? copy(m) : m));
			else if (object.material instanceof MeshStandardMaterial) object.material = copy(object.material);
		});

		const metrics = normalizeAvatarModel(scene, {
			targetHeight: model.height,
		});

		return {scene, materials: owned, metrics};
	}, [gltf, preset, model]);

	useEffect(() => {
		onMetrics?.(metrics);
	}, [metrics, onMetrics]);

	const player = useMemo(() => new AvatarAnimationPlayer(scene, gltf.animations, model.clips), [scene, gltf, model]);
	useEffect(
		() => () => {
			player.dispose();
			for (const material of materials) material.dispose();
			scene.traverse((object) => {
				if (object instanceof SkinnedMesh) object.skeleton.dispose();
			});
		},
		[player, materials, scene],
	);
	useFrame((_, dt) => {
		player.update(movement ? localLocomotion(movement.current) : animation, dt, reduced);
	});
	// Loader retains one bounded shared asset per model; instance materials, bones/mixer and bone textures are independent.
	return <primitive object={scene} visible={!firstPerson} dispose={null} />;
}
