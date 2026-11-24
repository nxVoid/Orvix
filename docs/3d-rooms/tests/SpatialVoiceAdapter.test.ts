// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AvatarState} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {describe, expect, it, vi} from 'vitest';
import type {Room} from '../../../relay_app/pkgs/livekit-client/src/index';
import {LiveKitSpatialVoiceAdapter} from '../../../relay_app/src/features/rooms3d/LiveKitSpatialVoiceAdapter';

function fixture() {
	const nodes = () => ({
		gain: {setTargetAtTime: vi.fn()},
		pan: {setTargetAtTime: vi.fn()},
		disconnect: vi.fn(),
		connect: vi.fn(),
	});
	const gain = nodes(),
		pan = nodes();
	const context = {currentTime: 1, createGain: () => gain, createStereoPanner: () => pan} as unknown as AudioContext;
	const track = {setWebAudioPlugins: vi.fn(), attach: vi.fn(), setVolume: vi.fn(), stop: vi.fn()};
	const screenTrack = {id: 'existing-screen'} as MediaStreamTrack;
	const remote = {
		identity: 'user_1_c1',
		isSpeaking: true,
		audioTrackPublications: new Map([
			['mic', {source: 'microphone', audioTrack: track}],
			['screen-audio', {source: 'screen_share_audio', audioTrack: track}],
		]),
		videoTrackPublications: new Map([
			[
				'screen',
				{source: 'screen_share', trackSid: 'screen', isMuted: false, videoTrack: {mediaStreamTrack: screenTrack}},
			],
			['unsubscribed', {source: 'screen_share', trackSid: 'unsubscribed', isMuted: false}],
		]),
	};
	const room = {
		state: 'connected',
		localParticipant: {identity: 'user_0_c0', isSpeaking: false, videoTrackPublications: new Map()},
		remoteParticipants: new Map([['user_1_c1', remote]]),
		on: vi.fn(),
		off: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as Room;
	const adapter = new LiveKitSpatialVoiceAdapter(room, {
		getRoom: () => room,
		getConnectionId: () => 'c0',
		getAudioContext: () => context,
	});
	const avatars: Array<AvatarState> = [0, 1].map((i) => ({
		userId: String(i),
		connectionId: `c${i}`,
		avatarId: 'violet',
		position: {x: i * 10, y: 0, z: 0},
		rotationY: 0,
		animation: 'idle',
		sequence: 0,
	}));
	return {adapter, track, room, gain, pan, avatars};
}
describe('provider adapter single playback ownership', () => {
	it('observes the existing participant/screen session without subscriptions, reconnects or capture', () => {
		const f = fixture();
		const s = f.adapter.getSnapshot();
		expect(s.connected).toBe(true);
		expect(s.participants).toHaveLength(2);
		expect(s.screens.map((t) => t.id)).toEqual(['screen', 'unsubscribed']);
		expect(s.screens[1].videoTrack).toBeUndefined();
		expect(s.screens[1].participantIdentity).toBe('user_1_c1');
		expect(f.room.connect).not.toHaveBeenCalled();
		expect(f.track.attach).not.toHaveBeenCalled();
		f.adapter.dispose();
		expect(f.room.disconnect).not.toHaveBeenCalled();
	});
	it('adds one plugin chain, keeps normal volume authority, and restores it on exit', () => {
		const f = fixture();
		f.adapter.updateSpatial(f.avatars, '0', 0, true);
		f.adapter.updateSpatial(f.avatars, '0', 1, true);
		expect(f.track.setWebAudioPlugins).toHaveBeenCalledTimes(1);
		expect(f.gain.gain.setTargetAtTime).toHaveBeenCalled();
		expect(f.pan.pan.setTargetAtTime).toHaveBeenCalled();
		expect(f.track.setVolume).not.toHaveBeenCalled();
		expect(f.track.attach).not.toHaveBeenCalled();
		f.adapter.dispose();
		f.adapter.dispose();
		expect(f.track.setWebAudioPlugins).toHaveBeenLastCalledWith([]);
		expect(f.gain.disconnect).toHaveBeenCalledTimes(1);
		expect(f.track.stop).not.toHaveBeenCalled();
	});
	it('leaves voice-only participants untouched and removes every owned event listener', () => {
		const f = fixture();
		f.adapter.subscribe(() => {});
		f.adapter.updateSpatial(f.avatars.slice(0, 1), '0', 0, true);
		expect(f.track.setWebAudioPlugins).not.toHaveBeenCalled();
		f.adapter.dispose();
		expect(f.room.off).toHaveBeenCalledTimes(12);
	});
});
