// SPDX-License-Identifier: AGPL-3.0-or-later
import {http} from '@app/features/platform/transport/RestTransport';
import Users from '@app/features/user/state/Users';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import {getSharedVoiceAudioContext} from '@app/features/voice/engine/VoiceSharedAudioContext';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	type AvatarId,
	type MovementInput,
	type RoomConfig,
	type RoomSnapshot,
	type RoomTemplateId,
	TEMPLATE_IDS,
} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {clsx} from 'clsx';
import {type FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import {AVATAR_PRESETS} from './AvatarCatalog';
import {AvatarSelectorModal} from './AvatarSelectorModal';
import {LiveKitSpatialVoiceAdapter} from './LiveKitSpatialVoiceAdapter';
import {ROOM_TEMPLATES, RoomBrowserModal} from './RoomBrowserModal';
import {isNewerRoomSnapshot, subscribeRoomSnapshot} from './RoomGateway';
import styles from './RoomPanel.module.css';
import {type CameraMode, type RoomMotion, type RoomRenderMetrics, RoomScene} from './RoomScene';
import {useRoomScreenWatch} from './RoomScreenWatch';
import type {SpatialVoiceSnapshot} from './SpatialVoiceAdapter';

function errorCode(error: unknown): string {
	if (error && typeof error === 'object' && 'body' in error) {
		const body = error.body;
		if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') return body.code;
	}
	return 'CONNECTION_ERROR';
}
export default function RoomPanel({channelId, onExit}: {channelId: string; onExit: () => void}) {
	const {t} = useLingui();
	const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
	const [voice, setVoice] = useState<SpatialVoiceSnapshot | null>(null);
	const [screenIdentity, setScreenIdentity] = useState<string | null>(null);
	useRoomScreenWatch(channelId, screenIdentity);
	const [status, setStatus] = useState('joining');
	const [failure, setFailure] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [spatial, setSpatial] = useState(false);
	const [canManage, setCanManage] = useState(false);
	const [avatarId, setAvatarId] = useState<AvatarId>('violet');
	const [avatarModalOpen, setAvatarModalOpen] = useState(false);
	const [roomBrowserOpen, setRoomBrowserOpen] = useState(false);
	const [settings, setSettings] = useState(false);
	const [draft, setDraft] = useState<RoomConfig | null>(null);
	const [quality, setQuality] = useState<'low' | 'standard' | 'high'>('standard');
	const [sensitivity, setSensitivity] = useState(1);
	const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
		try {
			return (localStorage.getItem('orvix_3d_camera_mode') as CameraMode) || 'third_person';
		} catch {
			return 'third_person';
		}
	});
	const [tutorialDismissed, setTutorialDismissed] = useState(() => {
		try {
			return localStorage.getItem('orvix_3d_tutorial_dismissed') === '1';
		} catch {
			return false;
		}
	});
	const [fps, setFps] = useState(60);
	const [activeEmote, setActiveEmote] = useState<'wave' | 'dance' | null>(null);
	const [isSitting, setIsSitting] = useState(false);
	const [chatMessage, setChatMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const emoteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const failureRef = useRef(failure);
	failureRef.current = failure;
	const motion = useRef<RoomMotion>({x: 0, z: 0, rotationY: 0, run: false, sit: false, cameraYaw: 0});
	const spatialRef = useRef(spatial);
	spatialRef.current = spatial;
	const userId = Users.getCurrentUser()?.id ?? '';
	const base = `/channels/${channelId}/room3d`;

	const toggleCamera = useCallback(() => {
		setCameraMode((prev) => {
			const next = prev === 'first_person' ? 'third_person' : 'first_person';
			try {
				localStorage.setItem('orvix_3d_camera_mode', next);
			} catch {}
			return next;
		});
	}, []);

	const triggerEmote = useCallback((emote: 'wave' | 'dance') => {
		motion.current.emote = emote;
		setActiveEmote(emote);
		if (emoteTimeout.current) clearTimeout(emoteTimeout.current);
		emoteTimeout.current = setTimeout(() => {
			if (motion.current.emote === emote) motion.current.emote = undefined;
			setActiveEmote(null);
		}, 3000);
	}, []);

	const toggleSit = useCallback(() => {
		motion.current.sit = !motion.current.sit;
		setIsSitting(Boolean(motion.current.sit));
	}, []);

	const handleMetrics = useCallback((metrics: RoomRenderMetrics) => {
		if (metrics.p95FrameMs > 0) {
			setFps(Math.min(144, Math.round(1000 / metrics.p95FrameMs)));
		}
	}, []);

	const handleSendChat = async (e: FormEvent) => {
		e.preventDefault();
		const trimmed = chatMessage.trim();
		if (!trimmed) return;
		setChatMessage('');
		try {
			await http.post(`/channels/${channelId}/messages`, {body: {content: trimmed}});
		} catch {
			/* Channel chat delivery error handled gracefully */
		}
	};

	const handleSelectRoomTemplate = async (templateId: RoomTemplateId) => {
		if (canManage && draft && draft.templateId !== templateId) {
			setBusy(true);
			try {
				await http.put(base, {body: {...draft, templateId}});
				setDraft({...draft, templateId});
				setRetry((r) => r + 1);
			} catch {
				setFailure('ROOM_ACCESS_DENIED');
			} finally {
				setBusy(false);
			}
		}
		setRoomBrowserOpen(false);
	};

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
			if (e.code === 'KeyV') {
				e.preventDefault();
				toggleCamera();
			} else if (e.code === 'Digit1') {
				e.preventDefault();
				triggerEmote('wave');
			} else if (e.code === 'Digit2') {
				e.preventDefault();
				triggerEmote('dance');
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [toggleCamera, triggerEmote]);

	useEffect(() => {
		const initialRoom = MediaEngine.room;
		const adapter = new LiveKitSpatialVoiceAdapter(initialRoom, {
			getRoom: () => MediaEngine.room,
			getConnectionId: () => MediaEngine.connectionId,
			getAudioContext: getSharedVoiceAudioContext,
		});
		const abort = new AbortController();
		let latest: RoomSnapshot | null = null;
		const acceptSnapshot = (next: RoomSnapshot) => {
			if (stopped || !latest || !isNewerRoomSnapshot(latest, next)) return;
			latest = next;
			setSnapshot(next);
		};
		const unsubscribeGateway = subscribeRoomSnapshot(channelId, acceptSnapshot);
		let stopped = false,
			sessionId: string | undefined,
			sequence = 0,
			timer: ReturnType<typeof setTimeout> | undefined;
		const updateVoice = () => {
			if (!stopped) setVoice(adapter.getSnapshot());
		};
		const unsubscribe = adapter.subscribe(updateVoice);
		updateVoice();
		setFailure(null);
		setSnapshot(null);
		setStatus('joining');
		async function tick() {
			if (stopped || !sessionId) return;
			if (failureRef.current) {
				adapter.updateSpatial([], userId, 0, false);
				return;
			}
			const started = performance.now();
			const current = adapter.getSnapshot();
			setVoice(current);
			if (!current.connected || !current.connectionId) {
				if (MediaEngine.room && MediaEngine.room !== initialRoom && MediaEngine.room.state === 'connected') {
					setRetry((r) => r + 1);
					return;
				}
				setStatus('voice-lost');
				adapter.updateSpatial([], userId, 0, false);
				timer = setTimeout(tick, 1000);
				return;
			}
			try {
				setIsSitting(Boolean(motion.current.sit));
				const input: MovementInput = {
					sessionId,
					sequence: ++sequence,
					connectionId: current.connectionId,
					x: motion.current.x,
					z: motion.current.z,
					rotationY: motion.current.rotationY,
					run: motion.current.run,
					sit: motion.current.sit,
					emote: motion.current.emote,
				};
				const r = await http.post<RoomSnapshot>(`${base}/move`, {
					body: input,
					signal: abort.signal,
					retries: 0,
					timeoutMs: 4000,
				});
				if (stopped) return;
				acceptSnapshot(r.body);
				setStatus(r.body.participants.length > 1 ? 'connected' : 'waiting');
				adapter.updateSpatial(
					r.body.participants,
					userId,
					motion.current.cameraYaw,
					spatialRef.current && r.body.config.spatialAudioEnabled,
				);
			} catch (error) {
				if (stopped) return;
				adapter.updateSpatial([], userId, 0, false);
				const code = errorCode(error);
				if (code === 'ROOM_SESSION_EXPIRED') {
					setRetry((r) => r + 1);
					return;
				}
				if (code !== 'CONNECTION_ERROR' && code !== 'MOVEMENT_RATE_LIMIT') {
					setFailure(code);
					return;
				}
				setStatus('reconnecting');
				timer = setTimeout(tick, 1000);
				return;
			}
			timer = setTimeout(tick, Math.max(0, 100 - (performance.now() - started)));
		}
		void (async () => {
			try {
				const v = adapter.getSnapshot();
				if (!v.connected || !v.connectionId) {
					setFailure('VOICE_CONNECTION_LOST');
					return;
				}
				const config = await http.get<{config: RoomConfig; avatarId: AvatarId; canManage: boolean}>(base, {
					signal: abort.signal,
				});
				if (stopped) return;
				setCanManage(config.body.canManage);
				setDraft(config.body.config);
				setAvatarId(config.body.avatarId);
				const r = await http.post<RoomSnapshot & {sessionId: string}>(`${base}/join`, {
					body: {connectionId: v.connectionId},
					retries: 0,
					signal: abort.signal,
				});
				sessionId = r.body.sessionId;
				if (stopped) {
					void http.post(`${base}/leave`, {body: {sessionId}}).catch(() => {});
					return;
				}
				latest = r.body;
				setSnapshot(r.body);
				timer = setTimeout(tick, 100);
			} catch (error) {
				if (!stopped) setFailure(errorCode(error));
			}
		})();
		return () => {
			stopped = true;
			abort.abort();
			clearTimeout(timer);
			if (emoteTimeout.current) clearTimeout(emoteTimeout.current);
			unsubscribe();
			unsubscribeGateway();
			adapter.dispose();
			if (sessionId) void http.post(`${base}/leave`, {body: {sessionId}}).catch(() => {});
		};
	}, [base, retry, userId]);
	useEffect(() => {
		if (!spatial) spatialRef.current = false;
	}, [spatial]);
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && settings) {
				setSettings(false);
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [settings]);
	async function changeAvatar(value: AvatarId) {
		setBusy(true);
		try {
			await http.put(`${base}/avatar`, {body: {avatarId: value}});
			setAvatarId(value);
			setRetry((r) => r + 1);
		} catch {
			setFailure('CONNECTION_ERROR');
		} finally {
			setBusy(false);
		}
	}
	async function saveSettings() {
		if (!draft || !canManage) return;
		setBusy(true);
		try {
			await http.put(base, {body: draft});
			setRetry((r) => r + 1);
		} catch {
			setFailure('ROOM_ACCESS_DENIED');
		} finally {
			setBusy(false);
		}
	}
	let message = '';
	if (failure === 'ROOM_FULL') message = t`This 3D room is full. Voice is still available.`;
	else if (failure === 'ROOM_ACCESS_DENIED' || failure === 'VOICE_MEMBERSHIP_REQUIRED')
		message = t`You no longer have access to this room.`;
	else if (failure === 'VOICE_CONNECTION_LOST') message = t`Voice connection lost.`;
	else if (failure === 'GRAPHICS_UNSUPPORTED') message = t`3D graphics are unavailable. You can continue using voice.`;
	else if (failure) message = t`The 3D session ended. Try again or return to voice.`;
	else if (status === 'voice-lost') message = t`Voice connection lost.`;
	else if (status === 'reconnecting') message = t`Reconnecting to the 3D room…`;
	else if (status === 'waiting') message = t`Waiting for other 3D participants…`;
	else if (status === 'joining') message = t`Joining the multiplayer session…`;

	const currentPreset = AVATAR_PRESETS[avatarId] ?? AVATAR_PRESETS.violet;
	const currentTemplate = snapshot?.config.templateId ?? 'gaming';
	const templateCard = ROOM_TEMPLATES[currentTemplate] ?? ROOM_TEMPLATES.gaming;
	const isLocalSpeaking = voice?.participants.some((p) => p.userId === userId && p.speaking) ?? false;

	return (
		<section aria-label={t`3D Room`} className={styles.root}>
			{message && (
				<div role="status" className={styles.message}>
					{message}
					{failure && (
						<button type="button" onClick={() => setRetry((r) => r + 1)}>
							<Trans>Try again</Trans>
						</button>
					)}
					<button type="button" onClick={onExit} style={{marginLeft: 8}}>
						<Trans>Return to voice</Trans>
					</button>
				</div>
			)}
			{snapshot && !failure && (
				<div
					style={{
						position: 'relative',
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						width: '100%',
						height: '100%',
					}}
				>
					<RoomScene
						names={Object.fromEntries(
							snapshot.participants.map((p) => [p.userId, Users.getUser(p.userId)?.displayName ?? p.userId]),
						)}
						loadingLabel={t`Loading 3D assets…`}
						quality={quality}
						cameraSensitivity={sensitivity}
						cameraMode={cameraMode}
						onToggleCamera={toggleCamera}
						snapshot={snapshot}
						voice={voice}
						userId={userId}
						motion={motion}
						onFailure={() => setFailure('GRAPHICS_UNSUPPORTED')}
						onOpenScreen={onExit}
						onSelectScreen={setScreenIdentity}
						onMetrics={handleMetrics}
					/>

					{/* Spark-Inspired 3D In-Room HUD */}
					<div className={styles.hudOverlay}>
						{/* Top Bar */}
						<div className={styles.hudTopBar}>
							<div className={styles.hudGlassPanel}>
								<span className={styles.hudRoomTitle}>
									<span>{templateCard.icon}</span>
									<span>{templateCard.name}</span>
								</span>
								<span className={styles.hudBadge}>
									<Trans>Voice Room</Trans>
								</span>
								<span className={clsx(styles.hudBadge, styles.hudBadgeOnline)}>
									● {snapshot.participants.length}/{snapshot.config.maxParticipants}
								</span>
								<button
									type="button"
									className={styles.hudPillButton}
									onClick={() => {
										if (document.pointerLockElement) document.exitPointerLock();
										setRoomBrowserOpen(true);
									}}
									aria-label={t`Open Room Browser`}
								>
									🌐 <Trans>Rooms</Trans>
								</button>
								<button
									type="button"
									className={clsx(styles.hudPillButton, styles.hudPillButtonDanger)}
									onClick={onExit}
									aria-label={t`Return to Voice`}
								>
									✕ <Trans>Exit 3D</Trans>
								</button>
							</div>

							<div className={styles.hudGlassPanel}>
								<span className={styles.hudBadge}>{fps} FPS</span>
								<button
									type="button"
									className={styles.hudPillButton}
									disabled={busy}
									onClick={() => {
										if (document.pointerLockElement) document.exitPointerLock();
										setAvatarModalOpen(true);
									}}
									aria-label={t`Change Avatar`}
								>
									👤 <span>{currentPreset.name}</span>
								</button>
								<button
									type="button"
									className={clsx(styles.hudPillButton, settings && styles.hudPillButtonActive)}
									onClick={() => {
										if (!settings && document.pointerLockElement) document.exitPointerLock();
										setSettings((s) => !s);
									}}
									aria-label={t`Settings`}
								>
									⚙️ <Trans>Settings</Trans>
								</button>
							</div>
						</div>

						{/* Center-Top Tutorial Pill */}
						{!tutorialDismissed && (
							<div className={styles.hudTutorialPill} role="status">
								<span>
									<Trans>Click scene to look</Trans>
								</span>
								<span>•</span>
								<span>
									<kbd className={styles.hudTutorialKey}>WASD</kbd> <Trans>Move</Trans>
								</span>
								<span>•</span>
								<span>
									<kbd className={styles.hudTutorialKey}>Shift</kbd> <Trans>Run</Trans>
								</span>
								<span>•</span>
								<span>
									<kbd className={styles.hudTutorialKey}>V</kbd> <Trans>1st/3rd Person</Trans>
								</span>
								<span>•</span>
								<span>
									<kbd className={styles.hudTutorialKey}>E</kbd> <Trans>Sit</Trans>
								</span>
								<span>•</span>
								<span>
									<kbd className={styles.hudTutorialKey}>1 / 2</kbd> <Trans>Emotes</Trans>
								</span>
								<button
									type="button"
									className={styles.modalCloseButton}
									style={{width: 20, height: 20, fontSize: 11, marginLeft: 6}}
									onClick={() => {
										setTutorialDismissed(true);
										try {
											localStorage.setItem('orvix_3d_tutorial_dismissed', '1');
										} catch {}
									}}
									aria-label={t`Dismiss tutorial`}
								>
									✕
								</button>
							</div>
						)}

						{/* Settings Popover Dropdown */}
						{settings && (
							<>
								<div className={styles.popoverBackdrop} onClick={() => setSettings(false)} role="presentation" />
								<div
									className={styles.hudSettingsPopover}
									role="dialog"
									aria-label={t`3D Settings`}
									onPointerDown={(e) => e.stopPropagation()}
									onClick={(e) => e.stopPropagation()}
								>
									<div className={styles.hudSettingsPopoverHeader}>
										<span>
											⚙️ <Trans>3D Settings</Trans>
										</span>
										<button
											type="button"
											className={styles.modalCloseButton}
											style={{width: 22, height: 22, fontSize: 12}}
											onClick={() => setSettings(false)}
											aria-label={t`Close settings`}
										>
											✕
										</button>
									</div>
									<label>
										<Trans>Graphics</Trans>
										<select value={quality} onChange={(e) => setQuality(e.target.value as 'low' | 'standard' | 'high')}>
											<option value="low">{t`Low`}</option>
											<option value="standard">{t`Standard`}</option>
											<option value="high">{t`High`}</option>
										</select>
									</label>
									<label>
										<Trans>Camera sensitivity</Trans>
										<input
											type="range"
											min="0.25"
											max="2"
											step="0.25"
											value={sensitivity}
											onChange={(e) => setSensitivity(Number(e.target.value))}
										/>
									</label>
									<label style={{flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
										<input
											type="checkbox"
											checked={spatial}
											disabled={!snapshot?.config.spatialAudioEnabled || !!failure}
											onChange={(e) => setSpatial(e.target.checked)}
										/>
										<Trans>Spatial audio</Trans>
									</label>
									{canManage && draft && (
										<form
											onSubmit={(e) => {
												e.preventDefault();
												void saveSettings();
											}}
											style={{
												display: 'flex',
												flexDirection: 'column',
												gap: 10,
												marginTop: 6,
												borderTop: '1px solid rgba(255,255,255,0.1)',
												paddingTop: 10,
											}}
										>
											<label>
												<Trans>Room template</Trans>
												<select
													disabled={busy}
													value={draft.templateId}
													onChange={(e) => setDraft({...draft, templateId: e.target.value as RoomConfig['templateId']})}
												>
													{TEMPLATE_IDS.map((id) => (
														<option key={id} value={id}>
															{id}
														</option>
													))}
												</select>
											</label>
											<label style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
												<input
													type="checkbox"
													checked={draft.spatialAudioEnabled}
													onChange={(e) => setDraft({...draft, spatialAudioEnabled: e.target.checked})}
												/>
												<Trans>Allow spatial audio</Trans>
											</label>
											<label>
												<Trans>Capacity</Trans>
												<input
													type="number"
													min={1}
													max={16}
													value={draft.maxParticipants}
													onChange={(e) => setDraft({...draft, maxParticipants: Number(e.target.value)})}
												/>
											</label>
											<button type="submit" disabled={busy} className={styles.secondaryButton}>
												<Trans>Save settings</Trans>
											</button>
										</form>
									)}
									<details style={{marginTop: 8, fontSize: 11, color: '#9e9ab0'}}>
										<summary style={{cursor: 'pointer'}}>
											<Trans>Avatar & Asset Credits</Trans>
										</summary>
										<p style={{marginTop: 6}}>
											RobotExpressive (CC0), Fox (CC BY 4.0), Quaternius Humanoids & Universal Animations (CC0).
										</p>
									</details>
								</div>
							</>
						)}

						{/* Bottom Center Action Dock */}
						<div className={styles.hudBottomDock}>
							<div className={styles.hudActionGroup}>
								<button
									type="button"
									className={clsx(styles.hudPillButton, cameraMode === 'first_person' && styles.hudPillButtonActive)}
									onClick={toggleCamera}
									title={t`Toggle Camera (V)`}
								>
									📷 {cameraMode === 'first_person' ? t`1st Person` : t`3rd Person`} (V)
								</button>
								<button
									type="button"
									className={clsx(styles.hudPillButton, isSitting && styles.hudPillButtonActive)}
									onClick={toggleSit}
									title={t`Sit or Stand (E)`}
								>
									🪑 {isSitting ? t`Stand` : t`Sit`} (E)
								</button>
								<button
									type="button"
									className={clsx(styles.hudPillButton, activeEmote === 'wave' && styles.hudPillButtonActive)}
									onClick={() => triggerEmote('wave')}
									title={t`Wave (1)`}
								>
									👋 <Trans>Wave (1)</Trans>
								</button>
								<button
									type="button"
									className={clsx(styles.hudPillButton, activeEmote === 'dance' && styles.hudPillButtonActive)}
									onClick={() => triggerEmote('dance')}
									title={t`Dance (2)`}
								>
									🕺 <Trans>Dance (2)</Trans>
								</button>
								<span className={clsx(styles.hudBadge, isLocalSpeaking && styles.hudBadgeOnline)}>
									🎙️ {isLocalSpeaking ? t`Speaking` : t`Voice Ready`}
								</span>
							</div>

							<div className={styles.hudChatInputWrap}>
								<form onSubmit={handleSendChat}>
									<input
										type="text"
										className={styles.hudChatInput}
										value={chatMessage}
										onChange={(e) => setChatMessage(e.target.value)}
										placeholder={t`Send a message to room participants…`}
									/>
								</form>
							</div>
						</div>
					</div>
				</div>
			)}
			{avatarModalOpen && (
				<AvatarSelectorModal
					currentAvatarId={avatarId}
					busy={busy}
					onSelect={(id) => void changeAvatar(id)}
					onClose={() => setAvatarModalOpen(false)}
				/>
			)}
			{roomBrowserOpen && (
				<RoomBrowserModal
					currentTemplateId={snapshot?.config.templateId ?? 'gaming'}
					participantCount={snapshot?.participants.length ?? 0}
					maxParticipants={snapshot?.config.maxParticipants ?? 16}
					canManage={canManage}
					busy={busy}
					onSelectAndEnter={handleSelectRoomTemplate}
					onClose={() => setRoomBrowserOpen(false)}
				/>
			)}
		</section>
	);
}
