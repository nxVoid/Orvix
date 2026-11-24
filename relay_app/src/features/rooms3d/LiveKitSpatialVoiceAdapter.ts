// SPDX-License-Identifier: AGPL-3.0-or-later

import {distanceGain} from '@relay/schema/src/domains/rooms3d/RoomGeometry';
import type {AvatarState} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {ConnectionState, type RemoteAudioTrack, type Room, RoomEvent, Track} from 'livekit-client';
import {parseVoiceParticipantIdentity} from '../voice/utils/VoiceParticipantIdentity';
import type {SpatialVoiceAdapter, SpatialVoiceSnapshot} from './SpatialVoiceAdapter';

const events = [
	RoomEvent.ParticipantConnected,
	RoomEvent.ParticipantDisconnected,
	RoomEvent.ActiveSpeakersChanged,
	RoomEvent.TrackPublished,
	RoomEvent.TrackUnpublished,
	RoomEvent.TrackSubscribed,
	RoomEvent.TrackUnsubscribed,
	RoomEvent.TrackMuted,
	RoomEvent.TrackUnmuted,
	RoomEvent.ConnectionStateChanged,
	RoomEvent.LocalTrackPublished,
	RoomEvent.LocalTrackUnpublished,
] as const;
export class LiveKitSpatialVoiceAdapter implements SpatialVoiceAdapter {
	private readonly listeners = new Set<() => void>();
	private readonly plugins = new Map<RemoteAudioTrack, {gain: GainNode; pan: StereoPannerNode}>();
	private disposed = false;
	constructor(
		private readonly room: Room | null,
		private readonly session: {
			getRoom(): Room | null;
			getConnectionId(): string | null;
			getAudioContext(): AudioContext | null;
		},
	) {}
	getSnapshot(): SpatialVoiceSnapshot {
		const room = this.room;
		if (!room) return {connected: false, connectionId: null, participants: [], screens: []};
		const participants = [room.localParticipant, ...room.remoteParticipants.values()];
		return {
			connected: room.state === ConnectionState.Connected && this.session.getRoom() === room,
			connectionId: this.session.getConnectionId(),
			participants: participants.map((p) => ({...parseVoiceParticipantIdentity(p.identity), speaking: p.isSpeaking})),
			screens: participants.flatMap((p) =>
				[...p.videoTrackPublications.values()].flatMap((pub) => {
					const track = pub.videoTrack?.mediaStreamTrack;
					return pub.source === Track.Source.ScreenShare && !pub.isMuted
						? [
								{
									id: pub.trackSid,
									userId: parseVoiceParticipantIdentity(p.identity).userId,
									participantIdentity: p.identity,
									videoTrack: track,
								},
							]
						: [];
				}),
			),
		};
	}
	subscribe(listener: () => void) {
		if (this.disposed) return () => {};
		this.listeners.add(listener);
		for (const event of events) this.room?.on(event, listener);
		return () => {
			this.listeners.delete(listener);
			for (const event of events) this.room?.off(event, listener);
		};
	}
	updateSpatial(avatars: ReadonlyArray<AvatarState>, localUserId: string, cameraYaw: number, enabled: boolean) {
		if (this.disposed) return;
		const local = avatars.find((a) => a.userId === localUserId);
		const context = enabled && local ? this.session.getAudioContext() : null;
		const active = new Set<RemoteAudioTrack>();
		if (context && local)
			for (const p of this.room?.remoteParticipants.values() ?? []) {
				const {userId, connectionId} = parseVoiceParticipantIdentity(p.identity);
				const remote = avatars.find((a) => a.userId === userId && a.connectionId === connectionId);
				// Ordinary voice-only users keep their normal audio path and volume.
				if (!remote) continue;
				for (const pub of p.audioTrackPublications.values()) {
					const track = pub.audioTrack;
					if (pub.source !== Track.Source.Microphone || !track || !('setWebAudioPlugins' in track)) continue;
					active.add(track);
					let nodes = this.plugins.get(track);
					if (!nodes) {
						nodes = {gain: context.createGain(), pan: context.createStereoPanner()};
						// Existing LiveKit WebAudio path owns playback; no attach(), capture or second source.
						track.setWebAudioPlugins([nodes.gain, nodes.pan]);
						this.plugins.set(track, nodes);
					}
					const dx = remote.position.x - local.position.x,
						dz = remote.position.z - local.position.z;
					nodes.gain.gain.setTargetAtTime(distanceGain(Math.hypot(dx, dz)), context.currentTime, 0.08);
					nodes.pan.pan.setTargetAtTime(
						Math.max(-1, Math.min(1, (dx * Math.cos(cameraYaw) - dz * Math.sin(cameraYaw)) / 8)),
						context.currentTime,
						0.08,
					);
				}
			}
		for (const [track, nodes] of this.plugins)
			if (!active.has(track)) {
				track.setWebAudioPlugins([]);
				nodes.gain.disconnect();
				nodes.pan.disconnect();
				this.plugins.delete(track);
			}
	}
	dispose() {
		if (this.disposed) return;
		this.updateSpatial([], '', 0, false);
		for (const listener of this.listeners) for (const event of events) this.room?.off(event, listener);
		this.listeners.clear();
		this.disposed = true;
	}
}
