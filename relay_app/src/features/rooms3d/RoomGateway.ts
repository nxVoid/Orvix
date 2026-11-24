// SPDX-License-Identifier: AGPL-3.0-or-later
import {type RoomSnapshot, RoomSnapshotSchema} from '@relay/schema/src/domains/rooms3d/RoomSchemas';

const listeners = new Map<string, Set<(snapshot: RoomSnapshot) => void>>();
export function receiveRoomSnapshot(data: unknown) {
	if (
		!data ||
		typeof data !== 'object' ||
		!('channel_id' in data) ||
		typeof data.channel_id !== 'string' ||
		!('snapshot' in data)
	)
		return;
	const room = listeners.get(data.channel_id);
	if (!room?.size) return;
	const snapshot = RoomSnapshotSchema.safeParse(data.snapshot);
	if (snapshot.success) for (const listener of room) listener(snapshot.data);
}
export function subscribeRoomSnapshot(channelId: string, listener: (snapshot: RoomSnapshot) => void) {
	let room = listeners.get(channelId);
	if (!room) {
		room = new Set();
		listeners.set(channelId, room);
	}
	room.add(listener);
	return () => {
		room.delete(listener);
		if (!room.size) listeners.delete(channelId);
	};
}

export function isNewerRoomSnapshot(current: RoomSnapshot, next: RoomSnapshot): boolean {
	return current.generation === next.generation && next.revision > current.revision;
}
