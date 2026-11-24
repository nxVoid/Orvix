// SPDX-License-Identifier: AGPL-3.0-or-later
import {beforeEach, describe, expect, it, vi} from 'vitest';

const f = vi.hoisted(() => ({
	room: {remoteParticipants: new Map([['remote', {}]])},
	engine: {room: null as unknown, channelId: 'channel', guildId: 'guild'},
	watching: [] as Array<string>,
	subscribed: false,
	cleanup: undefined as (() => void) | undefined,
	add: vi.fn(),
	stop: vi.fn(),
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
}));
vi.mock('../../../relay_app/src/features/voice/engine/MediaEngineFacade', () => ({default: f.engine}));
vi.mock('../../../relay_app/src/features/voice/engine/VoiceMediaGraph', () => ({
	selectVoiceMediaGraphViewerStreamKeys: () => f.watching,
}));
vi.mock('../../../relay_app/src/features/voice/engine/VoiceMediaGraphStore', () => ({
	voiceMediaGraphStore: {getGraphSnapshot: () => ({})},
}));
vi.mock('../../../relay_app/src/features/voice/engine/VoiceStreamWatchState', () => ({
	addWatchedStreamKey: f.add,
	stopWatchingStreamKey: f.stop,
	getStreamKeyForParticipantIdentity: () => 'stream-key',
}));
vi.mock('../../../relay_app/src/features/voice/engine/v2/VoiceEngineV2AppSubscriptionAdapter', () => ({
	default: {
		isScreenShareSubscribed: () => f.subscribed,
		subscribeToScreenShare: f.subscribe,
		unsubscribeFromScreenShare: f.unsubscribe,
	},
}));

import {acquireRoomScreenWatch} from '../../../relay_app/src/features/rooms3d/RoomScreenWatch';

beforeEach(() => {
	vi.clearAllMocks();
	f.engine.room = f.room;
	f.watching = [];
	f.subscribed = false;
	f.cleanup = undefined;
});
describe('TV uses the existing authorized call watch graph', () => {
	it('starts and releases only its own remote viewer demand', () => {
		f.cleanup = acquireRoomScreenWatch('channel', 'remote');
		expect(f.add).toHaveBeenCalledWith('stream-key');
		expect(f.subscribe).toHaveBeenCalledWith('remote', null, 'carousel');
		f.cleanup?.();
		expect(f.stop).toHaveBeenCalledWith('stream-key', {guildId: 'guild', channelId: 'channel', clearPinned: false});
		expect(f.unsubscribe).toHaveBeenCalledWith('remote');
	});
	it('preserves an existing ordinary-view watch on exit', () => {
		f.watching = ['stream-key'];
		f.subscribed = true;
		f.cleanup = acquireRoomScreenWatch('channel', 'remote');
		f.cleanup?.();
		expect(f.add).not.toHaveBeenCalled();
		expect(f.subscribe).not.toHaveBeenCalled();
		expect(f.stop).not.toHaveBeenCalled();
		expect(f.unsubscribe).not.toHaveBeenCalled();
	});
	it('ignores other channels and spoofed or local identities', () => {
		acquireRoomScreenWatch('different-channel', 'remote');
		acquireRoomScreenWatch('channel', 'not-a-participant');
		acquireRoomScreenWatch('channel', null);
		expect(f.add).not.toHaveBeenCalled();
		expect(f.subscribe).not.toHaveBeenCalled();
	});
	it('does not tear down a replacement voice session', () => {
		f.cleanup = acquireRoomScreenWatch('channel', 'remote');
		f.engine.room = {};
		f.cleanup?.();
		expect(f.stop).not.toHaveBeenCalled();
		expect(f.unsubscribe).not.toHaveBeenCalled();
	});
});
