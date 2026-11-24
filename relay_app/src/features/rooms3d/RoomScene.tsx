// SPDX-License-Identifier: AGPL-3.0-or-later
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {
	interpolationFactor,
	moveAvatar,
	nearestSeat,
	type Position,
} from '@relay/schema/src/domains/rooms3d/RoomGeometry';
import type {AvatarState, RoomSnapshot, RoomTemplateId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {
	Component,
	memo,
	type ReactNode,
	type RefObject,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {ACESFilmicToneMapping, CanvasTexture, type Group, MathUtils, SRGBColorSpace} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ApprovedAvatar} from './ApprovedAvatar';
import type {AvatarMetrics} from './AvatarNormalizer';
import {RoomEnvironment} from './RoomEnvironments';
import styles from './RoomPanel.module.css';
import type {SpatialVoiceSnapshot} from './SpatialVoiceAdapter';
import {VirtualTelevision} from './VirtualTelevision';

export type CameraMode = 'first_person' | 'third_person';

export interface RoomMotion {
	x: number;
	z: number;
	run: boolean;
	sit?: boolean;
	emote?: 'wave' | 'dance';
	rotationY: number;
	cameraYaw: number;
}

const colors: Record<string, string> = {
	violet: '#9061f9',
	lunar: '#a8b8d8',
	ember: '#e6a16e',
	mint: '#72c8b1',
	alex: '#4e95ed',
	kai: '#f59e0b',
	marcus: '#64748b',
	jax: '#ef4444',
	leo: '#10b981',
	hunter: '#d97706',
	sam: '#ec4899',
	elena: '#8b5cf6',
	nova: '#06b6d4',
	raven: '#6366f1',
	orion: '#38bdf8',
	astra: '#a855f7',
	morgan: '#84cc16',
	valkyrie: '#eab308',
};

class GraphicsBoundary extends Component<{children: ReactNode; onFailure: () => void}, {failed: boolean}> {
	override state = {failed: false};
	static getDerivedStateFromError() {
		return {failed: true};
	}
	override componentDidCatch() {
		this.props.onFailure();
	}
	override render() {
		return this.state.failed ? null : this.props.children;
	}
}

function Controls({
	motion,
	position,
	sensitivity,
	template,
	cameraMode,
	onToggleCamera,
	onPrompt,
	eyeHeight = 1.65,
}: {
	sensitivity: number;
	motion: RefObject<RoomMotion>;
	position: RefObject<Position>;
	template: RoomTemplateId;
	cameraMode: CameraMode;
	onToggleCamera?: () => void;
	onPrompt: (prompt: string | null) => void;
	eyeHeight?: number;
}) {
	const {camera, gl} = useThree();
	const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
	controls.rotateSpeed = sensitivity;
	const keys = useRef(new Set<string>());
	const last = useRef({...position.current});
	const pitch = useRef(0);
	const yaw = useRef(0);
	const isLocked = useRef(false);

	useEffect(() => {
		const canvas = gl.domElement;
		canvas.tabIndex = 0;
		canvas.setAttribute('aria-label', '3D room movement');
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.minDistance = 1.5;
		controls.maxDistance = 10;
		controls.maxPolarAngle = Math.PI / 2 - 0.05;

		const onLockChange = () => {
			isLocked.current = document.pointerLockElement === canvas;
		};
		document.addEventListener('pointerlockchange', onLockChange);

		const onMouseMove = (e: MouseEvent) => {
			if (cameraMode === 'first_person' && isLocked.current) {
				yaw.current -= e.movementX * 0.0025 * sensitivity;
				pitch.current -= e.movementY * 0.0025 * sensitivity;
				pitch.current = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch.current));
			}
		};
		window.addEventListener('mousemove', onMouseMove);

		const focus = () => {
			canvas.focus({preventScroll: true});
			if (cameraMode === 'first_person' && document.pointerLockElement !== canvas) {
				void canvas.requestPointerLock();
			}
		};
		const clear = () => {
			keys.current.clear();
			motion.current.x = 0;
			motion.current.z = 0;
			motion.current.run = false;
		};
		const down = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (document.pointerLockElement) document.exitPointerLock();
				canvas.blur();
				clear();
				return;
			}
			if (event.code === 'KeyV') {
				event.preventDefault();
				onToggleCamera?.();
				return;
			}
			if (event.code === 'Digit1') {
				// Wave emote
				event.preventDefault();
				motion.current.emote = 'wave';
				setTimeout(() => {
					if (motion.current.emote === 'wave') motion.current.emote = undefined;
				}, 2000);
				return;
			}
			if (event.code === 'Digit2') {
				// Dance emote
				event.preventDefault();
				motion.current.emote = 'dance';
				setTimeout(() => {
					if (motion.current.emote === 'dance') motion.current.emote = undefined;
				}, 3000);
				return;
			}
			if (event.code === 'KeyE') {
				event.preventDefault();
				if (motion.current.sit) {
					motion.current.sit = false;
				} else {
					const seat = nearestSeat(position.current, template);
					if (seat) {
						position.current.x = seat.x;
						position.current.z = seat.z;
						motion.current.rotationY = seat.rotationY;
						motion.current.sit = true;
					}
				}
				return;
			}
			if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
				event.preventDefault();
				keys.current.add(event.code);
				if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
					motion.current.sit = false;
					motion.current.emote = undefined;
				}
			}
		};
		const up = (event: KeyboardEvent) => keys.current.delete(event.code);
		canvas.addEventListener('pointerdown', focus);
		canvas.addEventListener('keydown', down);
		canvas.addEventListener('blur', clear);
		window.addEventListener('keyup', up);
		window.addEventListener('blur', clear);
		document.addEventListener('visibilitychange', clear);
		return () => {
			clear();
			controls.dispose();
			document.removeEventListener('pointerlockchange', onLockChange);
			window.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('pointerdown', focus);
			canvas.removeEventListener('keydown', down);
			canvas.removeEventListener('blur', clear);
			window.removeEventListener('keyup', up);
			window.removeEventListener('blur', clear);
			document.removeEventListener('visibilitychange', clear);
		};
	}, [cameraMode, controls, gl, motion, onToggleCamera, position, sensitivity, template]);

	useFrame(() => {
		const p = position.current;
		const x = Number(keys.current.has('KeyD')) - Number(keys.current.has('KeyA'));
		const z = Number(keys.current.has('KeyS')) - Number(keys.current.has('KeyW'));
		const length = Math.max(1, Math.hypot(x, z));

		if (cameraMode === 'first_person') {
			controls.enabled = false;
			camera.position.set(p.x, eyeHeight, p.z);
			camera.rotation.set(0, 0, 0);
			camera.rotation.order = 'YXZ';
			camera.rotation.y = yaw.current;
			camera.rotation.x = pitch.current;

			const currentYaw = yaw.current;
			motion.current.x = (x * Math.cos(currentYaw) + z * Math.sin(currentYaw)) / length;
			motion.current.z = (z * Math.cos(currentYaw) - x * Math.sin(currentYaw)) / length;
			motion.current.cameraYaw = currentYaw;
			motion.current.rotationY = currentYaw;
		} else {
			controls.enabled = true;
			camera.position.x += p.x - last.current.x;
			camera.position.z += p.z - last.current.z;
			controls.target.set(p.x, 1.2, p.z);
			controls.update();

			const camYaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
			motion.current.x = (x * Math.cos(camYaw) + z * Math.sin(camYaw)) / length;
			motion.current.z = (z * Math.cos(camYaw) - x * Math.sin(camYaw)) / length;
			motion.current.cameraYaw = camYaw;
			if (x || z) motion.current.rotationY = Math.atan2(motion.current.x, motion.current.z);
		}

		motion.current.run = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
		last.current = {...p};

		// Contextual interaction prompt check
		if (motion.current.sit) {
			onPrompt('Press [E] or move to stand up');
		} else {
			const seat = nearestSeat(p, template);
			if (seat) {
				onPrompt(`Press [E] to sit on ${seat.label}`);
			} else {
				onPrompt(null);
			}
		}
	});
	return null;
}

function Nameplate({name, speaking, height = 2.25}: {name: string; speaking: boolean; height?: number}) {
	const texture = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 96;
		const c = canvas.getContext('2d');
		if (c) {
			c.fillStyle = speaking ? '#244b3b' : '#181823';
			c.fillRect(0, 0, 512, 96);
			c.font = 'bold 34px sans-serif';
			c.fillStyle = '#f2f0f7';
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillText(name, 256, 48, 480);
		}
		const t = new CanvasTexture(canvas);
		t.colorSpace = SRGBColorSpace;
		return t;
	}, [name, speaking]);
	useEffect(() => () => texture.dispose(), [texture]);
	return (
		<sprite position={[0, height, 0]} scale={[2.3, 0.43, 1]}>
			<spriteMaterial map={texture} transparent depthWrite={false} />
		</sprite>
	);
}

function Avatar({
	state,
	local,
	motion,
	position,
	template,
	speaking,
	name,
	firstPerson,
	onMetrics,
}: {
	state: AvatarState;
	local: boolean;
	motion: RefObject<RoomMotion>;
	position: RefObject<Position>;
	template: RoomTemplateId;
	speaking: boolean;
	name: string;
	firstPerson?: boolean;
	onMetrics?: (metrics: AvatarMetrics) => void;
}) {
	const group = useRef<Group>(null);
	const [avatarMetrics, setAvatarMetrics] = useState<AvatarMetrics | null>(null);
	const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
	useEffect(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const changed = () => setReduced(query.matches);
		query.addEventListener('change', changed);
		return () => query.removeEventListener('change', changed);
	}, []);
	const target = useRef(state);
	target.current = state;
	const sequence = useRef(-1);

	const handleMetrics = useCallback(
		(m: AvatarMetrics) => {
			setAvatarMetrics(m);
			if (local && onMetrics) onMetrics(m);
		},
		[local, onMetrics],
	);

	useFrame((_, dt) => {
		const g = group.current;
		if (!g) return;
		if (local) {
			if (sequence.current !== state.sequence) {
				const gap = Math.hypot(position.current.x - state.position.x, position.current.z - state.position.z);
				if (sequence.current < 0 || gap > 1.5) position.current = {...state.position};
				else {
					position.current.x = MathUtils.lerp(position.current.x, state.position.x, 0.25);
					position.current.z = MathUtils.lerp(position.current.z, state.position.z, 0.25);
				}
				sequence.current = state.sequence;
			}
			if (!motion.current.sit) {
				position.current = moveAvatar(position.current, motion.current, Math.min(dt, 0.05), template);
			}
			g.position.set(position.current.x, 0, position.current.z);
			g.rotation.y = motion.current.rotationY;
		} else {
			g.position.x = MathUtils.lerp(g.position.x, target.current.position.x, interpolationFactor(dt));
			g.position.z = MathUtils.lerp(g.position.z, target.current.position.z, interpolationFactor(dt));
			const turn = Math.atan2(Math.sin(state.rotationY - g.rotation.y), Math.cos(state.rotationY - g.rotation.y));
			g.rotation.y += turn * interpolationFactor(dt);
		}
	});

	const isFirstPersonLocal = local && firstPerson;

	return (
		<group ref={group} position={[state.position.x, 0, state.position.z]}>
			<ApprovedAvatar
				avatarId={state.avatarId}
				animation={state.animation}
				reduced={reduced}
				movement={local ? motion : undefined}
				firstPerson={isFirstPersonLocal}
				onMetrics={handleMetrics}
			/>
			{!isFirstPersonLocal && (
				<>
					<mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
						<ringGeometry args={[0.4, 0.46, 24]} />
						<meshBasicMaterial color={speaking ? '#74d8a6' : (colors[state.avatarId] ?? '#9061f9')} />
					</mesh>
					<Nameplate name={name} speaking={speaking} height={avatarMetrics?.nameplateHeight ?? 2.25} />
				</>
			)}
		</group>
	);
}

function RoomLights({template, quality}: {template: RoomTemplateId; quality: 'low' | 'standard' | 'high'}) {
	const shadows = quality !== 'low';
	const shadowMapSize = quality === 'high' ? 2048 : 1024;

	if (template === 'rooftop') {
		return (
			<>
				<color attach="background" args={['#131726']} />
				<fog attach="fog" args={['#131726', 22, 55]} />
				<ambientLight intensity={1.1} color="#7c8eb5" />
				<directionalLight
					position={[-6, 12, -8]}
					intensity={2.4}
					color="#ffddb8"
					castShadow={shadows}
					shadow-mapSize-width={shadowMapSize}
					shadow-mapSize-height={shadowMapSize}
					shadow-bias={-0.0004}
				/>
				<pointLight position={[0, 2.5, 2.8]} color="#ff7722" intensity={quality === 'high' ? 12 : 8} distance={8} />
			</>
		);
	}
	if (template === 'cinema') {
		return (
			<>
				<color attach="background" args={['#0e0b14']} />
				<fog attach="fog" args={['#0e0b14', 16, 36]} />
				<ambientLight intensity={0.9} color="#605075" />
				<directionalLight
					position={[0, 9, -5]}
					intensity={1.2}
					color="#e0d0f5"
					castShadow={shadows}
					shadow-mapSize-width={shadowMapSize}
					shadow-mapSize-height={shadowMapSize}
					shadow-bias={-0.0004}
				/>
				<pointLight position={[0, 3, 0]} color="#443366" intensity={4} distance={10} />
			</>
		);
	}
	if (template === 'meeting') {
		return (
			<>
				<color attach="background" args={['#171922']} />
				<fog attach="fog" args={['#171922', 20, 42]} />
				<ambientLight intensity={1.8} color="#e6ecff" />
				<directionalLight
					position={[4, 10, 4]}
					intensity={2.6}
					color="#f5f8ff"
					castShadow={shadows}
					shadow-mapSize-width={shadowMapSize}
					shadow-mapSize-height={shadowMapSize}
					shadow-bias={-0.0004}
				/>
				<pointLight position={[0, 4, 0]} color="#ffffff" intensity={quality === 'high' ? 14 : 9} distance={10} />
			</>
		);
	}
	// gaming
	return (
		<>
			<color attach="background" args={['#13121c']} />
			<fog attach="fog" args={['#13121c', 18, 38]} />
			<ambientLight intensity={1.5} color="#d8d0ea" />
			<directionalLight
				position={[5, 9, 4]}
				intensity={2.2}
				color="#f0e8ff"
				castShadow={shadows}
				shadow-mapSize-width={shadowMapSize}
				shadow-mapSize-height={shadowMapSize}
				shadow-bias={-0.0004}
			/>
			<pointLight position={[-4.5, 3.5, 0]} color="#ff9955" intensity={quality === 'high' ? 10 : 6} distance={8} />
			<pointLight position={[4.5, 3.5, 0]} color="#8866ff" intensity={quality === 'high' ? 10 : 6} distance={8} />
		</>
	);
}

export interface RoomRenderMetrics {
	drawCalls: number;
	triangles: number;
	geometries: number;
	textures: number;
	p95FrameMs: number;
}

function Metrics({onMetrics}: {onMetrics: (metrics: RoomRenderMetrics) => void}) {
	const frames = useRef<Array<number>>([]),
		elapsed = useRef(0);
	useFrame(({gl}, dt) => {
		frames.current.push(dt * 1000);
		if (frames.current.length > 120) frames.current.shift();
		elapsed.current += dt;
		if (elapsed.current < 1) return;
		elapsed.current = 0;
		const times = [...frames.current].sort((a, b) => a - b);
		onMetrics({
			drawCalls: gl.info.render.calls,
			triangles: gl.info.render.triangles,
			geometries: gl.info.memory.geometries,
			textures: gl.info.memory.textures,
			p95FrameMs: times[Math.floor(times.length * 0.95)] ?? 0,
		});
	});
	return null;
}

const StableRoomLights = memo(RoomLights);
const StableRoomEnvironment = memo(RoomEnvironment);

function Loaded({onReady}: {onReady: () => void}) {
	useEffect(onReady, [onReady]);
	return null;
}

function ContextGuard({onFailure}: {onFailure: () => void}) {
	const {gl} = useThree();
	useEffect(() => {
		const canvas = gl.domElement;
		canvas.addEventListener('webglcontextlost', onFailure);
		return () => canvas.removeEventListener('webglcontextlost', onFailure);
	}, [gl, onFailure]);
	return null;
}

export function RoomScene({
	snapshot,
	voice,
	userId,
	motion,
	onFailure,
	onOpenScreen,
	onSelectScreen,
	names,
	onMetrics,
	quality = 'standard',
	cameraSensitivity = 1,
	cameraMode = 'third_person',
	onToggleCamera,
	loadingLabel = 'Loading 3D assets…',
}: {
	loadingLabel?: string;
	quality?: 'low' | 'standard' | 'high';
	cameraSensitivity?: number;
	cameraMode?: CameraMode;
	onToggleCamera?: () => void;
	onMetrics?: (metrics: RoomRenderMetrics) => void;
	names: Readonly<Record<string, string>>;
	snapshot: RoomSnapshot;
	voice: SpatialVoiceSnapshot | null;
	userId: string;
	motion: RefObject<RoomMotion>;
	onFailure: () => void;
	onOpenScreen: () => void;
	onSelectScreen?: (identity: string | null) => void;
}) {
	const [assetReady, setAssetReady] = useState(false);
	const [prompt, setPrompt] = useState<string | null>(null);
	const [localMetrics, setLocalMetrics] = useState<AvatarMetrics | null>(null);
	const position = useRef<Position>({
		...(snapshot.participants.find((a) => a.userId === userId)?.position ?? {x: 0, y: 0, z: 6}),
	});

	const dprByQuality: Record<typeof quality, [number, number] | number> = {low: 1, standard: [1, 1.5], high: [1, 2]};
	const dpr = dprByQuality[quality];

	return (
		<div style={{flex: 1, minHeight: 180, position: 'relative'}}>
			{!assetReady && (
				<div role="status" style={{position: 'absolute', inset: 0, zIndex: 1, padding: 24, pointerEvents: 'none'}}>
					{loadingLabel}
				</div>
			)}
			{prompt && (
				<div className={styles.interactionPrompt} role="status">
					<span className={styles.promptKey}>E</span>
					<span>{prompt}</span>
				</div>
			)}
			<GraphicsBoundary onFailure={onFailure}>
				<Canvas
					shadows={quality !== 'low'}
					dpr={dpr}
					gl={{
						antialias: true,
						powerPreference: 'high-performance',
						toneMapping: ACESFilmicToneMapping,
						toneMappingExposure: 1.1,
					}}
					camera={{position: [0, 5, 12], fov: 55}}
					fallback={<p>WebGL unavailable</p>}
				>
					<StableRoomLights template={snapshot.config.templateId} quality={quality} />
					<Suspense fallback={null}>
						<StableRoomEnvironment template={snapshot.config.templateId} />
						<Loaded onReady={() => setAssetReady(true)} />
					</Suspense>
					{snapshot.participants.map((state) => (
						<Suspense key={state.userId} fallback={null}>
							<Avatar
								name={names[state.userId] ?? state.userId}
								state={state}
								local={state.userId === userId}
								firstPerson={cameraMode === 'first_person'}
								onMetrics={state.userId === userId ? setLocalMetrics : undefined}
								motion={motion}
								position={position}
								template={snapshot.config.templateId}
								speaking={
									voice?.participants.some(
										(p) => p.userId === state.userId && p.connectionId === state.connectionId && p.speaking,
									) ?? false
								}
							/>
						</Suspense>
					))}
					<VirtualTelevision
						template={snapshot.config.templateId}
						screens={voice?.screens ?? []}
						onOpen={onOpenScreen}
						names={names}
						localUserId={userId}
						onSelectScreen={onSelectScreen}
					/>
					<ContextGuard onFailure={onFailure} />
					{onMetrics && <Metrics onMetrics={onMetrics} />}
					<Controls
						motion={motion}
						position={position}
						sensitivity={cameraSensitivity}
						template={snapshot.config.templateId}
						onPrompt={setPrompt}
						cameraMode={cameraMode}
						onToggleCamera={onToggleCamera}
						eyeHeight={localMetrics?.eyeHeight ?? 1.65}
					/>
				</Canvas>
			</GraphicsBoundary>
		</div>
	);
}
