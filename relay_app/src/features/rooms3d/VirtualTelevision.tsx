// SPDX-License-Identifier: AGPL-3.0-or-later
import type {RoomTemplateId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {useEffect, useMemo, useState} from 'react';
import {SRGBColorSpace, VideoTexture} from 'three';
import type {SharedScreen} from './SpatialVoiceAdapter';

export interface RoomScreenSpec {
	position: [number, number, number];
	screenSize: [number, number]; // [width, height] in meters
	frameSize: [number, number, number]; // [width, height, depth] in meters
	label: string;
}

export const ROOM_SCREEN_SPECS: Record<RoomTemplateId, RoomScreenSpec> = {
	gaming: {
		position: [0, 2.6, -7.84],
		screenSize: [6.4, 3.6],
		frameSize: [6.7, 3.9, 0.12],
		label: 'Gaming Lounge TV',
	},
	meeting: {
		position: [0, 2.6, -7.84],
		screenSize: [6.4, 3.6],
		frameSize: [6.7, 3.9, 0.12],
		label: 'Executive Conference Display',
	},
	cinema: {
		position: [0, 3.0, -7.84],
		screenSize: [9.6, 5.4],
		frameSize: [10.0, 5.8, 0.14],
		label: 'Cinema Projection Screen',
	},
	rooftop: {
		position: [0, 2.6, -7.74],
		screenSize: [6.4, 3.6],
		frameSize: [6.7, 3.9, 0.12],
		label: 'Rooftop Pergola Display',
	},
};

export function VirtualTelevision({
	template,
	screens,
	onOpen,
	names,
	localUserId,
	onSelectScreen,
}: {
	template: RoomTemplateId;
	screens: ReadonlyArray<SharedScreen>;
	onOpen: () => void;
	names?: Readonly<Record<string, string>>;
	localUserId?: string;
	onSelectScreen?: (identity: string | null) => void;
}) {
	const spec = ROOM_SCREEN_SPECS[template];
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// Keep selection stable across publication order changes; prefer a friend's stream.
	const activeShare =
		screens.find((screen) => screen.id === selectedId) ??
		screens.find((screen) => screen.userId !== localUserId) ??
		screens[0];
	const activeTrack = activeShare?.videoTrack;
	const remoteIdentity = activeShare?.userId !== localUserId ? (activeShare?.participantIdentity ?? null) : null;
	useEffect(() => {
		onSelectScreen?.(remoteIdentity);
		return () => onSelectScreen?.(null);
	}, [remoteIdentity, onSelectScreen]);

	const video = useMemo(() => document.createElement('video'), []);
	const [videoAspect, setVideoAspect] = useState<number>(16 / 9);

	const texture = useMemo(() => {
		const t = new VideoTexture(video);
		t.colorSpace = SRGBColorSpace;
		return t;
	}, [video]);

	useEffect(() => {
		if (!activeTrack) {
			video.pause();
			video.srcObject = null;
			return;
		}

		video.muted = true;
		video.playsInline = true;
		video.autoplay = true;
		video.srcObject = new MediaStream([activeTrack]);

		const onMeta = () => {
			if (video.videoWidth > 0 && video.videoHeight > 0) {
				setVideoAspect(video.videoWidth / video.videoHeight);
			}
		};
		video.addEventListener('loadedmetadata', onMeta);
		void video.play().catch(() => {});

		return () => {
			video.removeEventListener('loadedmetadata', onMeta);
			video.pause();
			video.srcObject = null;
		};
	}, [activeTrack, video]);

	useEffect(() => () => texture.dispose(), [texture]);

	// Calculate fitted dimensions within TV display
	const [screenWidth, screenHeight] = spec.screenSize;
	const screenAspect = screenWidth / screenHeight;

	let renderWidth = screenWidth;
	let renderHeight = screenHeight;
	if (videoAspect > screenAspect) {
		// Wider than 16:9 (e.g. 21:9) -> letterbox vertically
		renderHeight = screenWidth / videoAspect;
	} else if (videoAspect < screenAspect) {
		// Taller than 16:9 (e.g. 4:3 or vertical video) -> pillarbox horizontally
		renderWidth = screenHeight * videoAspect;
	}

	return (
		<group position={spec.position}>
			{/* Modeled TV Bezel Housing */}
			<mesh position={[0, 0, -spec.frameSize[2] / 2]} castShadow receiveShadow>
				<boxGeometry args={spec.frameSize} />
				<meshStandardMaterial color="#0c0b14" roughness={0.35} metalness={0.7} />
			</mesh>

			{/* Metallic Beveled Accent Trim */}
			<mesh position={[0, 0, -0.005]}>
				<boxGeometry args={[spec.screenSize[0] + 0.08, spec.screenSize[1] + 0.08, 0.02]} />
				<meshStandardMaterial color="#2a2538" roughness={0.2} metalness={0.9} />
			</mesh>

			{/* Black Matte Screen Base (Natural Letterboxing Backplate) */}
			<mesh position={[0, 0, 0.002]}>
				<planeGeometry args={spec.screenSize} />
				<meshStandardMaterial color="#050508" roughness={0.8} />
			</mesh>

			{/* Active Video Screen Surface or Ambient Idle Standby */}
			{activeShare ? (
				/* biome-ignore lint/a11y/noStaticElementInteractions: R3F 3D mesh interaction */
				<mesh position={[0, 0, 0.02]} onClick={onOpen}>
					<planeGeometry args={[renderWidth, renderHeight]} />
					<meshBasicMaterial map={texture} toneMapped={false} />
				</mesh>
			) : (
				<group position={[0, 0, 0.02]}>
					<mesh>
						<planeGeometry args={spec.screenSize} />
						<meshStandardMaterial color="#0e0c17" roughness={0.5} />
					</mesh>
					{/* Ambient Standby Center Glowing Crest */}
					<mesh position={[0, 0.2, 0.002]}>
						<ringGeometry args={[0.3, 0.38, 32]} />
						<meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
					</mesh>
					<mesh position={[0, -0.4, 0.002]}>
						<boxGeometry args={[1.8, 0.04, 0.001]} />
						<meshStandardMaterial color="#6366f1" emissive="#4f46e5" emissiveIntensity={0.4} />
					</mesh>
				</group>
			)}

			{/* Power / Signal LED Status Indicator on Bottom Bezel */}
			<mesh position={[0, -spec.screenSize[1] / 2 - 0.08, 0.01]}>
				<sphereGeometry args={[0.02, 16, 16]} />
				<meshStandardMaterial
					color={activeShare ? '#10b981' : '#06b6d4'}
					emissive={activeShare ? '#059669' : '#0891b2'}
					emissiveIntensity={2.0}
				/>
			</mesh>

			{/* Multi-Stream Switcher Bar (when multiple participants share screens) */}
			{screens.length > 1 && (
				<group position={[0, spec.screenSize[1] / 2 + 0.32, 0.02]}>
					{screens.map((s, idx) => {
						const isSelected = s.id === activeShare?.id;
						const sharerName = names?.[s.userId] ?? s.userId;
						const xPos = (idx - (screens.length - 1) / 2) * 1.5;
						return (
							/* biome-ignore lint/a11y/noStaticElementInteractions: R3F 3D mesh button */
							<group key={s.id} position={[xPos, 0, 0]} onClick={() => setSelectedId(s.id)} name={sharerName}>
								<mesh>
									<boxGeometry args={[1.35, 0.28, 0.04]} />
									<meshStandardMaterial
										color={isSelected ? '#9061f9' : '#1f1b2e'}
										emissive={isSelected ? '#7c3aed' : '#000000'}
										emissiveIntensity={isSelected ? 0.4 : 0}
										roughness={0.4}
									/>
								</mesh>
							</group>
						);
					})}
				</group>
			)}
		</group>
	);
}
