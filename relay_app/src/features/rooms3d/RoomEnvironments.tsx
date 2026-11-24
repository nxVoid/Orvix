// SPDX-License-Identifier: AGPL-3.0-or-later
import {useLoader} from '@react-three/fiber';
import type {RoomTemplateId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {useMemo} from 'react';
import {Mesh, MeshStandardMaterial} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

interface ModelProps {
	url: string;
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: [number, number, number] | number;
	tint?: string;
}

function PropModel({url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, tint}: ModelProps) {
	const gltf = useLoader(GLTFLoader, url);
	const scene = useMemo(() => {
		const clone = cloneSkeleton(gltf.scene);
		clone.traverse((obj) => {
			if (obj instanceof Mesh) {
				obj.castShadow = true;
				obj.receiveShadow = true;
				if (tint && obj.material instanceof MeshStandardMaterial) {
					const mat = obj.material.clone();
					mat.color.set(tint);
					obj.material = mat;
				}
			}
		});
		return clone;
	}, [gltf, tint]);

	const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
	return <primitive object={scene} position={position} rotation={rotation} scale={s} />;
}

const ASSETS = {
	chairOffice: new URL('./assets/environments/furniture-chair-office.glb', import.meta.url).href,
	chairLounge: new URL('./assets/environments/furniture-chair-lounge.glb', import.meta.url).href,
	sofa: new URL('./assets/environments/furniture-sofa.glb', import.meta.url).href,
	tableLarge: new URL('./assets/environments/furniture-table-large.glb', import.meta.url).href,
	plant: new URL('./assets/environments/furniture-plant.glb', import.meta.url).href,
	bookshelf: new URL('./assets/environments/furniture-bookshelf.glb', import.meta.url).href,
	lamp: new URL('./assets/environments/furniture-lamp.glb', import.meta.url).href,
	building: new URL('./assets/environments/skyline-building.glb', import.meta.url).href,
} as const;

export function GamingEnvironment() {
	return (
		<group>
			{/* Floor: Polished dark oak parquet */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
				<planeGeometry args={[20, 16]} />
				<meshStandardMaterial color="#211d24" roughness={0.65} metalness={0.1} />
			</mesh>

			{/* Plush Area Rug */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[-4, 0.005, 0]}>
				<planeGeometry args={[6, 8]} />
				<meshStandardMaterial color="#372f42" roughness={0.9} />
			</mesh>

			{/* Walls */}
			<mesh position={[0, 2.5, -8]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#17151f" roughness={0.8} />
			</mesh>
			<mesh position={[-10, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#1c1926" roughness={0.8} />
			</mesh>
			<mesh position={[10, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#1c1926" roughness={0.8} />
			</mesh>
			<mesh position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#14131c" roughness={0.8} />
			</mesh>

			{/* Acoustic Wood Slat Accent Panels on Front Wall */}
			{[-7, -5, 5, 7].map((x) => (
				<mesh key={x} position={[x, 2.5, -7.85]} receiveShadow>
					<boxGeometry args={[1.6, 4.5, 0.08]} />
					<meshStandardMaterial color="#3a2e28" roughness={0.7} />
				</mesh>
			))}

			{/* Lounge Area: Sofas & Coffee Table */}
			<PropModel url={ASSETS.sofa} position={[-4.2, 0, -1.5]} rotation={[0, Math.PI / 2, 0]} scale={0.46} />
			<PropModel url={ASSETS.sofa} position={[-4.2, 0, 1.5]} rotation={[0, Math.PI / 2, 0]} scale={0.46} />
			<PropModel url={ASSETS.tableLarge} position={[-2.4, 0, 0]} scale={[0.55, 0.65, 0.55]} />

			{/* Gaming Desk & Chairs Section */}
			<mesh position={[4.2, 0.37, 0]} receiveShadow castShadow>
				<boxGeometry args={[1.2, 0.74, 4.5]} />
				<meshStandardMaterial color="#1e1c26" roughness={0.4} metalness={0.3} />
			</mesh>
			{[-1.4, 0, 1.4].map((z) => (
				<group key={z}>
					{/* Gaming Chair */}
					<PropModel url={ASSETS.chairLounge} position={[3.3, 0, z]} rotation={[0, Math.PI / 2, 0]} scale={0.52} />
					{/* Dual Monitors on Desk */}
					<mesh position={[4.2, 0.95, z - 0.35]} rotation={[0, -0.2, 0]} castShadow>
						<boxGeometry args={[0.08, 0.42, 0.7]} />
						<meshStandardMaterial color="#0e0d14" roughness={0.2} metalness={0.7} />
					</mesh>
					<mesh position={[4.2, 0.95, z + 0.35]} rotation={[0, 0.2, 0]} castShadow>
						<boxGeometry args={[0.08, 0.42, 0.7]} />
						<meshStandardMaterial color="#0e0d14" roughness={0.2} metalness={0.7} />
					</mesh>
				</group>
			))}

			{/* Decorative Bookshelves and Greenery */}
			<PropModel url={ASSETS.bookshelf} position={[-9.6, 0, -5]} rotation={[0, Math.PI / 2, 0]} scale={0.48} />
			<PropModel url={ASSETS.bookshelf} position={[-9.6, 0, 5]} rotation={[0, Math.PI / 2, 0]} scale={0.48} />
			<PropModel url={ASSETS.plant} position={[-9.2, 0, -2.5]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[-9.2, 0, 2.5]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[9.2, 0, -6]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[9.2, 0, 6]} scale={1.15} />

			{/* Floor Lamps with Warm Accent Glow */}
			<PropModel url={ASSETS.lamp} position={[-8.5, 0, -7]} scale={1.05} />
			<PropModel url={ASSETS.lamp} position={[8.5, 0, -7]} scale={1.05} />
			<pointLight position={[-8.5, 2.2, -7]} color="#ff9955" intensity={6} distance={6} />
			<pointLight position={[8.5, 2.2, -7]} color="#8866ff" intensity={6} distance={6} />
		</group>
	);
}

export function MeetingEnvironment() {
	return (
		<group>
			{/* Floor: Executive polished terrazzo stone */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
				<planeGeometry args={[20, 16]} />
				<meshStandardMaterial color="#262933" roughness={0.4} metalness={0.15} />
			</mesh>

			{/* Walls: Contemporary architectural grey with warm acoustic panels */}
			<mesh position={[0, 2.5, -8]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#1a1c24" roughness={0.7} />
			</mesh>
			<mesh position={[-10, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#1f222b" roughness={0.7} />
			</mesh>
			<mesh position={[10, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#1f222b" roughness={0.7} />
			</mesh>
			<mesh position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#171921" roughness={0.7} />
			</mesh>

			{/* Executive Conference Table in Center */}
			<mesh position={[0, 0.37, 0]} castShadow receiveShadow>
				<boxGeometry args={[5.2, 0.74, 2.2]} />
				<meshStandardMaterial color="#302a24" roughness={0.3} metalness={0.2} />
			</mesh>

			{/* 16 Executive Conference Chairs around Table */}
			{[-2.0, -1.2, -0.4, 0.4, 1.2, 2.0].map((x) => (
				<group key={`n-${x}`}>
					<PropModel url={ASSETS.chairOffice} position={[x, 0, -1.45]} rotation={[0, 0, 0]} scale={0.52} />
					<PropModel url={ASSETS.chairOffice} position={[x, 0, 1.45]} rotation={[0, Math.PI, 0]} scale={0.52} />
				</group>
			))}
			{[-0.5, 0.5].map((z) => (
				<group key={`w-${z}`}>
					<PropModel url={ASSETS.chairOffice} position={[-2.9, 0, z]} rotation={[0, Math.PI / 2, 0]} scale={0.52} />
					<PropModel url={ASSETS.chairOffice} position={[2.9, 0, z]} rotation={[0, -Math.PI / 2, 0]} scale={0.52} />
				</group>
			))}

			{/* Corner Decorative Bookshelves & Architectural Ficus Plants */}
			<PropModel url={ASSETS.bookshelf} position={[-9.6, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.48} />
			<PropModel url={ASSETS.bookshelf} position={[9.6, 0, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.48} />
			<PropModel url={ASSETS.plant} position={[-8.8, 0, -6.8]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[8.8, 0, -6.8]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[-8.8, 0, 6.8]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[8.8, 0, 6.8]} scale={1.15} />

			{/* Recessed Overhead Direct Lighting */}
			<pointLight position={[0, 4.5, 0]} color="#f0f4ff" intensity={15} distance={12} />
			<pointLight position={[-4, 4.2, -3]} color="#f0f4ff" intensity={8} distance={8} />
			<pointLight position={[4, 4.2, -3]} color="#f0f4ff" intensity={8} distance={8} />
		</group>
	);
}

export function CinemaEnvironment() {
	return (
		<group>
			{/* Floor: Deep theater-grade acoustic carpet */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
				<planeGeometry args={[20, 16]} />
				<meshStandardMaterial color="#1a1520" roughness={0.9} />
			</mesh>

			{/* Walls: Deep acoustic fabric with dampening */}
			<mesh position={[0, 2.5, -8]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#120e17" roughness={0.9} />
			</mesh>
			<mesh position={[-10, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#15111c" roughness={0.9} />
			</mesh>
			<mesh position={[10, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
				<boxGeometry args={[16, 5, 0.2]} />
				<meshStandardMaterial color="#15111c" roughness={0.9} />
			</mesh>
			<mesh position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} receiveShadow>
				<boxGeometry args={[20, 5, 0.2]} />
				<meshStandardMaterial color="#100d14" roughness={0.9} />
			</mesh>

			{/* Stepped Seating Risers */}
			<mesh position={[0, 0.15, 2.2]} receiveShadow castShadow>
				<boxGeometry args={[14, 0.3, 2.5]} />
				<meshStandardMaterial color="#1e1826" roughness={0.8} />
			</mesh>
			<mesh position={[0, 0.35, 5.2]} receiveShadow castShadow>
				<boxGeometry args={[14, 0.7, 2.5]} />
				<meshStandardMaterial color="#1e1826" roughness={0.8} />
			</mesh>

			{/* 18 Theater Seats across 3 Rows with Walkable Center Aisle */}
			{[-3.0, -2.0, -1.0, 1.0, 2.0, 3.0].map((x) => (
				<group key={`seat-${x}`}>
					{/* Row 1 (Floor level) */}
					<PropModel url={ASSETS.chairLounge} position={[x, 0, -0.8]} rotation={[0, 0, 0]} scale={0.52} />
					{/* Row 2 (Riser 1) */}
					<PropModel url={ASSETS.chairLounge} position={[x, 0.3, 2.2]} rotation={[0, 0, 0]} scale={0.52} />
					{/* Row 3 (Riser 2) */}
					<PropModel url={ASSETS.chairLounge} position={[x, 0.7, 5.2]} rotation={[0, 0, 0]} scale={0.52} />
				</group>
			))}

			{/* Wall Sconce Lighting */}
			{[-9.8, 9.8].map((x) =>
				[-4, 0, 4].map((z) => (
					<group key={`${x}-${z}`} position={[x, 2.2, z]}>
						<mesh>
							<boxGeometry args={[0.1, 0.3, 0.15]} />
							<meshStandardMaterial color="#ffc477" emissive="#ffaa44" emissiveIntensity={0.8} />
						</mesh>
						<pointLight color="#ff9944" intensity={2.5} distance={4} />
					</group>
				)),
			)}
		</group>
	);
}

export function RooftopEnvironment() {
	return (
		<group>
			{/* Rooftop Paver Decking */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
				<planeGeometry args={[20, 16]} />
				<meshStandardMaterial color="#2d2926" roughness={0.7} metalness={0.1} />
			</mesh>

			{/* Perimeter Glass Safety Railing with Stainless Posts */}
			<mesh position={[0, 0.6, -7.95]}>
				<boxGeometry args={[20, 1.2, 0.08]} />
				<meshStandardMaterial color="#88aacc" roughness={0.1} transparent opacity={0.35} metalness={0.9} />
			</mesh>
			<mesh position={[-9.95, 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
				<boxGeometry args={[16, 1.2, 0.08]} />
				<meshStandardMaterial color="#88aacc" roughness={0.1} transparent opacity={0.35} metalness={0.9} />
			</mesh>
			<mesh position={[9.95, 0.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
				<boxGeometry args={[16, 1.2, 0.08]} />
				<meshStandardMaterial color="#88aacc" roughness={0.1} transparent opacity={0.35} metalness={0.9} />
			</mesh>
			<mesh position={[0, 0.6, 7.95]} rotation={[0, Math.PI, 0]}>
				<boxGeometry args={[20, 1.2, 0.08]} />
				<meshStandardMaterial color="#88aacc" roughness={0.1} transparent opacity={0.35} metalness={0.9} />
			</mesh>

			{/* Outdoor Lounge Area: Sofas & Patio Table */}
			<PropModel url={ASSETS.sofa} position={[-4.2, 0, -1.8]} rotation={[0, Math.PI / 2, 0]} scale={0.46} />
			<PropModel url={ASSETS.sofa} position={[-4.2, 0, 1.0]} rotation={[0, Math.PI / 2, 0]} scale={0.46} />
			<PropModel url={ASSETS.tableLarge} position={[-2.4, 0, -0.4]} scale={[0.55, 0.6, 0.55]} />

			{/* Rooftop Bar Counter with Stools */}
			<mesh position={[4.6, 0.52, -1.8]} receiveShadow castShadow>
				<boxGeometry args={[1.2, 1.04, 3.8]} />
				<meshStandardMaterial color="#2c2833" roughness={0.4} metalness={0.3} />
			</mesh>
			{[-2.8, -1.8, -0.8].map((z) => (
				<PropModel key={z} url={ASSETS.chairLounge} position={[3.7, 0, z]} rotation={[0, Math.PI / 2, 0]} scale={0.58} />
			))}

			{/* Central Firepit Lounge */}
			<mesh position={[0, 0.22, 2.8]} receiveShadow castShadow>
				<cylinderGeometry args={[1.0, 1.1, 0.44, 24]} />
				<meshStandardMaterial color="#1e1a17" roughness={0.8} />
			</mesh>
			{/* Glowing Fire Embers */}
			<mesh position={[0, 0.45, 2.8]}>
				<cylinderGeometry args={[0.75, 0.75, 0.08, 16]} />
				<meshStandardMaterial color="#ff6622" emissive="#ff4400" emissiveIntensity={2.5} />
			</mesh>
			<pointLight position={[0, 0.75, 2.8]} color="#ff7722" intensity={10} distance={7} />

			{/* Firepit Surrounding Chairs */}
			<PropModel url={ASSETS.chairOffice} position={[-1.6, 0, 2.8]} rotation={[0, Math.PI / 2, 0]} scale={0.52} />
			<PropModel url={ASSETS.chairOffice} position={[1.6, 0, 2.8]} rotation={[0, -Math.PI / 2, 0]} scale={0.52} />
			<PropModel url={ASSETS.chairOffice} position={[0, 0, 4.2]} rotation={[0, Math.PI, 0]} scale={0.52} />

			{/* Lush Perimeter Planter Boxes */}
			<PropModel url={ASSETS.plant} position={[-8.5, 0, -7]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[-6.5, 0, -7]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[6.5, 0, -7]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[8.5, 0, -7]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[-8.5, 0, 7]} scale={1.15} />
			<PropModel url={ASSETS.plant} position={[8.5, 0, 7]} scale={1.15} />

			{/* 3D City Skyline in the Distance */}
			<PropModel url={ASSETS.building} position={[-25, -12, -35]} scale={0.7} />
			<PropModel url={ASSETS.building} position={[0, -10, -42]} scale={0.9} />
			<PropModel url={ASSETS.building} position={[26, -14, -36]} scale={0.75} />
			<PropModel url={ASSETS.building} position={[-38, -15, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.8} />
			<PropModel url={ASSETS.building} position={[38, -15, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.8} />
			<PropModel url={ASSETS.building} position={[0, -15, 42]} rotation={[0, Math.PI, 0]} scale={0.85} />

			{/* Atmospheric Sunset / Twilight Lighting */}
			<directionalLight position={[-8, 12, -15]} intensity={1.8} color="#ffd4aa" castShadow />
			<ambientLight intensity={0.8} color="#6688cc" />
		</group>
	);
}

export function RoomEnvironment({template}: {template: RoomTemplateId}) {
	if (template === 'meeting') return <MeetingEnvironment />;
	if (template === 'cinema') return <CinemaEnvironment />;
	if (template === 'rooftop') return <RooftopEnvironment />;
	return <GamingEnvironment />;
}
