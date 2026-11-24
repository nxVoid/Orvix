// SPDX-License-Identifier: AGPL-3.0-or-later

import {useEffect} from 'react';
import MediaEngine from '../voice/engine/MediaEngineFacade';
import {selectVoiceMediaGraphViewerStreamKeys} from '../voice/engine/VoiceMediaGraph';
import {voiceMediaGraphStore} from '../voice/engine/VoiceMediaGraphStore';
import {
	addWatchedStreamKey,
	getStreamKeyForParticipantIdentity,
	stopWatchingStreamKey,
} from '../voice/engine/VoiceStreamWatchState';
import subscriptions from '../voice/engine/v2/VoiceEngineV2AppSubscriptionAdapter';

// A TV is a viewer of the existing call, never another capture or voice session.
export function useRoomScreenWatch(channelId: string, identity: string | null): void {
	useEffect(() => acquireRoomScreenWatch(channelId, identity), [channelId, identity]);
}

export function acquireRoomScreenWatch(channelId: string, identity: string | null): (() => void) | undefined {
	const room = MediaEngine.room;
	if (!identity || !room || MediaEngine.channelId !== channelId || !room.remoteParticipants.has(identity)) return;
	const guildId = MediaEngine.guildId;
	const key = getStreamKeyForParticipantIdentity(guildId, channelId, identity);
	if (!key) return;
	const alreadyWatching = selectVoiceMediaGraphViewerStreamKeys(voiceMediaGraphStore.getGraphSnapshot()).includes(key);
	const alreadySubscribed = subscriptions.isScreenShareSubscribed(identity);
	// The normal watch graph retains server permissions, local video preferences and audio ownership.
	if (!alreadyWatching) addWatchedStreamKey(key);
	if (!alreadySubscribed) subscriptions.subscribeToScreenShare(identity, null, 'carousel');
	return () => {
		// A replacement voice session must never be modified by the old TV cleanup.
		if (MediaEngine.room !== room) return;
		if (!alreadyWatching) stopWatchingStreamKey(key, {guildId, channelId, clearPinned: false});
		if (!alreadySubscribed && !alreadyWatching) subscriptions.unsubscribeFromScreenShare(identity);
	};
}
