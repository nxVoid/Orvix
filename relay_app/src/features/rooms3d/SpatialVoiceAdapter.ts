// SPDX-License-Identifier: AGPL-3.0-or-later
import type {AvatarState} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
export interface VoiceParticipant {
	userId: string;
	connectionId: string;
	speaking: boolean;
}
export interface SharedScreen {
	id: string;
	userId: string;
	videoTrack?: MediaStreamTrack;
	participantIdentity?: string;
}
export interface SpatialVoiceSnapshot {
	connected: boolean;
	connectionId: string | null;
	participants: Array<VoiceParticipant>;
	screens: Array<SharedScreen>;
}
export interface SpatialVoiceAdapter {
	getSnapshot(): SpatialVoiceSnapshot;
	subscribe(listener: () => void): () => void;
	updateSpatial(avatars: ReadonlyArray<AvatarState>, localUserId: string, cameraYaw: number, enabled: boolean): void;
	dispose(): void;
}
