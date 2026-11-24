// SPDX-License-Identifier: AGPL-3.0-or-later
import {Box3, type Object3D, Vector3} from 'three';

export interface AvatarMetrics {
	height: number;
	eyeHeight: number;
	nameplateHeight: number;
	scale: number;
	radius: number;
}

export interface NormalizationOptions {
	targetHeight: number;
	eyeRatio?: number;
	nameplateMargin?: number;
}

/**
 * Normalizes an avatar hierarchy to real-world metric dimensions (1 unit = 1 meter).
 *
 * Responsibilities:
 * 1. Computes character bounds across skinned meshes and child nodes.
 * 2. Normalizes scale so character top-of-head matches targetHeight in meters.
 * 3. Aligns feet precisely with the ground plane (y = 0) with zero clipping.
 * 4. Centers horizontally on the origin (x = 0, z = 0).
 * 5. Calculates collision capsule radius, eye level (for 1st-person camera), and nameplate height.
 */
export function normalizeAvatarModel(
	root: Object3D,
	options: NormalizationOptions,
): AvatarMetrics {
	// Reset any existing local transformations before computing bounding box
	root.position.set(0, 0, 0);
	root.rotation.set(0, 0, 0);
	root.scale.set(1, 1, 1);
	root.updateMatrixWorld(true);

	const box = new Box3().setFromObject(root);
	const size = box.getSize(new Vector3());
	const center = box.getCenter(new Vector3());

	const rawHeight = Math.max(0.01, size.y);
	const targetHeight = Math.max(0.5, options.targetHeight);
	const scale = targetHeight / rawHeight;

	root.scale.set(scale, scale, scale);
	root.position.x = -center.x * scale;
	root.position.y = -box.min.y * scale;
	root.position.z = -center.z * scale;
	root.updateMatrixWorld(true);

	const eyeRatio = options.eyeRatio ?? 0.92;
	const nameplateMargin = options.nameplateMargin ?? 0.35;

	return {
		height: targetHeight,
		eyeHeight: targetHeight * eyeRatio,
		nameplateHeight: targetHeight + nameplateMargin,
		scale,
		radius: Math.max(0.3, Math.min(0.5, size.x * scale * 0.45)),
	};
}
