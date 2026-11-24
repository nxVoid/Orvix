// SPDX-License-Identifier: AGPL-3.0-or-later
import {describe, expect, it, vi} from 'vitest';
import {DEFAULT_ROOM_CONFIG, type RoomSnapshot} from '../../../packages/schema/src/domains/rooms3d/RoomSchemas';
import {
	isNewerRoomSnapshot,
	receiveRoomSnapshot,
	subscribeRoomSnapshot,
} from '../../../relay_app/src/features/rooms3d/RoomGateway';

const snapshot: RoomSnapshot = {
	config: DEFAULT_ROOM_CONFIG,
	generation: '2eb2c739-2dd8-4fb5-a1f2-ac7b6fb1211e',
	revision: 1,
	serverTime: 1000,
	participants: [],
};
describe('scoped gateway room delivery', () => {
	it('ignores unobserved channels, malformed snapshots and disposed listeners', () => {
		const callback = vi.fn();
		const dispose = subscribeRoomSnapshot('1', callback);
		receiveRoomSnapshot({channel_id: '2', snapshot});
		receiveRoomSnapshot({channel_id: '1', snapshot: {...snapshot, participants: new Array(17).fill({})}});
		expect(callback).not.toHaveBeenCalled();
		receiveRoomSnapshot({channel_id: '1', snapshot});
		expect(callback).toHaveBeenCalledTimes(1);
		dispose();
		receiveRoomSnapshot({channel_id: '1', snapshot});
		expect(callback).toHaveBeenCalledTimes(1);
	});
	it('rejects delayed snapshots from a former session generation and stale revisions', () => {
		expect(isNewerRoomSnapshot(snapshot, {...snapshot, revision: 2})).toBe(true);
		expect(isNewerRoomSnapshot(snapshot, snapshot)).toBe(false);
		expect(isNewerRoomSnapshot(snapshot, {...snapshot, generation: 'another-room-generation', revision: 999})).toBe(
			false,
		);
	});
});
