// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolated rendering fixture: does not connect to voice, production API or real users.

import {Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
	AVATAR_IDS,
	DEFAULT_ROOM_CONFIG,
	type RoomSnapshot,
} from '../../../packages/schema/src/domains/rooms3d/RoomSchemas';
import {type RoomMotion, RoomScene} from '../../../relay_app/src/features/rooms3d/RoomScene';
import {AvatarProbe} from './avatar-probe';

declare global {
	interface Window {
		roomFixture: {
			motion: RoomMotion;
			failure: boolean;
			metrics: unknown;
			exits: number;
			avatarChecks?: unknown;
			screenTrack?: MediaStreamTrack;
			videoStarts?: number;
			videoStops?: number;
		};
	}
}
const initial: RoomSnapshot = {
	generation: '2eb2c739-2dd8-4fb5-a1f2-ac7b6fb1211e',
	revision: 1,
	serverTime: Date.now(),
	config: DEFAULT_ROOM_CONFIG,
	participants: Array.from({length: 16}, (_, i) => ({
		userId: String(i),
		connectionId: `c${i}`,
		avatarId: AVATAR_IDS[i % AVATAR_IDS.length],
		position: {x: -7 + (i % 8) * 2, y: 0, z: 4 - Math.floor(i / 8) * 5},
		rotationY: 0,
		animation: (['idle', 'walk', 'run'] as const)[i % 3],
		sequence: 0,
	})),
};
function Fixture() {
	const [open, setOpen] = useState(true),
		[snapshot, setSnapshot] = useState(initial);
	const [showScreen, setShowScreen] = useState(false);
	const screen = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 320;
		canvas.height = 180;
		return {canvas, track: canvas.captureStream(10).getVideoTracks()[0]};
	}, []);
	const motion = useRef<RoomMotion>({x: 0, z: 0, run: false, rotationY: 0, cameraYaw: 0});
	window.roomFixture ??= {motion: motion.current, failure: false, metrics: null, exits: 0};
	window.roomFixture.screenTrack = screen.track;
	useEffect(() => {
		const originalPlay = HTMLMediaElement.prototype.play;
		const originalPause = HTMLMediaElement.prototype.pause;
		HTMLMediaElement.prototype.play = function () {
			window.roomFixture.videoStarts = (window.roomFixture.videoStarts ?? 0) + 1;
			return originalPlay.call(this);
		};
		HTMLMediaElement.prototype.pause = function () {
			window.roomFixture.videoStops = (window.roomFixture.videoStops ?? 0) + 1;
			originalPause.call(this);
		};
		return () => {
			HTMLMediaElement.prototype.play = originalPlay;
			HTMLMediaElement.prototype.pause = originalPause;
		};
	}, []);

	useEffect(() => {
		const timer = setInterval(() => {
			const c = screen.canvas.getContext('2d');
			if (!c) return;
			c.fillStyle = '#472885';
			c.fillRect(0, 0, 320, 180);
			c.fillStyle = 'white';
			c.font = '24px sans-serif';
			c.fillText('Existing video track', 32, 90);
		}, 100);
		return () => {
			clearInterval(timer);
			screen.track.stop();
		};
	}, [screen]);
	useEffect(() => {
		const timer = setInterval(
			() =>
				setSnapshot((s) => ({
					...s,
					revision: s.revision + 1,
					participants: s.participants.map((p, i) =>
						i === 0
							? p
							: {
									...p,
									position: {
										...p.position,
										x: initial.participants[i].position.x + Math.sin(Date.now() / 1000 + i) * 0.3,
									},
								},
					),
				})),
			100,
		);
		return () => clearInterval(timer);
	}, []);
	return (
		<main style={{height: '100vh', background: '#0d0d12', color: 'white', display: 'flex', flexDirection: 'column'}}>
			<Suspense fallback={null}>
				<AvatarProbe
					onResult={(r) => {
						window.roomFixture.avatarChecks = r;
					}}
				/>
			</Suspense>
			<div>
				<button type="button" id="toggle" onClick={() => setOpen((v) => !v)}>
					Enter / exit 3D
				</button>
				<button type="button" id="share" onClick={() => setShowScreen((v) => !v)}>
					Synthetic subscribed screen
				</button>
				<input id="chat" aria-label="Chat input" placeholder="Type here without moving" />
				<select
					id="template"
					onChange={(e) => setSnapshot((s) => ({...s, config: {...s.config, templateId: e.target.value as any}}))}
				>
					<option>gaming</option>
					<option>meeting</option>
					<option>cinema</option>
					<option>rooftop</option>
				</select>
			</div>
			{open && (
				<RoomScene
					snapshot={snapshot}
					voice={{
						connected: true,
						connectionId: 'c0',
						participants: [],
						screens: showScreen ? [{id: 'synthetic', userId: '1', videoTrack: screen.track}] : [],
					}}
					userId="0"
					names={Object.fromEntries(snapshot.participants.map((p) => [p.userId, `Orvix user ${p.userId}`]))}
					motion={motion}
					onFailure={() => {
						window.roomFixture.failure = true;
					}}
					onMetrics={(m) => {
						window.roomFixture.metrics = m;
					}}
					onOpenScreen={() => {
						window.roomFixture.exits++;
					}}
				/>
			)}
		</main>
	);
}
createRoot(document.getElementById('root')!).render(<Fixture />);
