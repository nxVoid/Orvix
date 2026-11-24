// SPDX-License-Identifier: AGPL-3.0-or-later
import {Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3} from 'three';
import {describe, expect, it} from 'vitest';
import {normalizeAvatarModel} from '../../../relay_app/src/features/rooms3d/AvatarNormalizer';

describe('AvatarNormalizer utility', () => {
	it('normalizes arbitrary geometry to target height and aligns feet to ground y=0', () => {
		const root = new Group();
		// Create a mock body box of arbitrary size: height 5.0m, offset from origin
		const geom = new BoxGeometry(2, 5, 2);
		const mesh = new Mesh(geom, new MeshBasicMaterial());
		mesh.position.set(10, 8, -5); // arbitrary offset
		root.add(mesh);

		const metrics = normalizeAvatarModel(root, {targetHeight: 1.80});

		expect(metrics.height).toBe(1.80);
		expect(metrics.eyeHeight).toBeCloseTo(1.80 * 0.92, 2);
		expect(metrics.nameplateHeight).toBeCloseTo(1.80 + 0.35, 2);

		// Verify bounding box in world space
		root.updateMatrixWorld(true);
		const box = new Box3().setFromObject(root);
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());

		expect(size.y).toBeCloseTo(1.80, 2);
		expect(box.min.y).toBeCloseTo(0, 2); // Feet on the floor!
		expect(center.x).toBeCloseTo(0, 2);  // Centered on origin
		expect(center.z).toBeCloseTo(0, 2);
	});

	it('computes collision capsule radius proportionally', () => {
		const root = new Group();
		const geom = new BoxGeometry(1, 2, 1);
		root.add(new Mesh(geom, new MeshBasicMaterial()));

		const metrics = normalizeAvatarModel(root, {targetHeight: 1.80});
		expect(metrics.radius).toBeGreaterThanOrEqual(0.3);
		expect(metrics.radius).toBeLessThanOrEqual(0.5);
	});
});
