// SPDX-License-Identifier: AGPL-3.0-or-later

export interface RelayButtonBadgeCountInput {
	incomingFriendRequestCount: number;
	inlineDmsCollapsed: boolean;
	showCollapsedUnreadDmsBadge: boolean;
	showIncomingFriendRequestBadge: boolean;
	unreadDmCount: number;
}

export function getRelayButtonBadgeCount({
	incomingFriendRequestCount,
	inlineDmsCollapsed,
	showCollapsedUnreadDmsBadge,
	showIncomingFriendRequestBadge,
	unreadDmCount,
}: RelayButtonBadgeCountInput): number {
	let count = 0;
	if (inlineDmsCollapsed && showCollapsedUnreadDmsBadge) {
		count += unreadDmCount;
	}
	if (showIncomingFriendRequestBadge) {
		count += incomingFriendRequestCount;
	}
	return count;
}
