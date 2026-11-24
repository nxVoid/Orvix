// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import styles from '@app/features/app/components/layout/GuildsLayout.module.css';
import {resolveGuildListIndicatorBarTarget} from '@app/features/app/components/layout/sidebar_nav/GuildListIndicator';
import {getRelayButtonBadgeCount} from '@app/features/app/components/layout/sidebar_nav/RelayButtonBadgeUtils';
import {useContextMenuHoverState} from '@app/features/app/hooks/useContextMenuHoverState';
import {useHover} from '@app/features/app/hooks/useHover';
import {useMergeRefs} from '@app/features/app/hooks/useMergeRefs';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import Channels from '@app/features/channel/state/Channels';
import {DIRECT_MESSAGES_DESCRIPTOR, PERSONAL_NOTES_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import SelectedChannel from '@app/features/navigation/state/SelectedChannel';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {useLocation} from '@app/features/platform/components/router/RouterReact';
import ReadStates from '@app/features/read_state/state/ReadStates';
import Relationships from '@app/features/relationship/state/Relationships';
import {RelayButtonContextMenu} from '@app/features/ui/action_menu/RelayButtonContextMenu';
import * as ContextMenuCommands from '@app/features/ui/commands/ContextMenuCommands';
import {MentionBadgeAnimated} from '@app/features/ui/components/MentionBadge';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import MobileLayout from '@app/features/ui/state/MobileLayout';
import SidebarPreferences from '@app/features/ui/state/SidebarPreferences';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {RelayIcon} from '@app/features/ui/components/icons/RelayIcon';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {ME} from '@relay/constants/src/AppConstants';
import {RelationshipTypes} from '@relay/constants/src/UserConstants';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef} from 'react';

const UNREAD_DMS_DESCRIPTOR = msg({
	message: '{displayedUnreadDmCount, plural, one {# unread DM} other {# unread DMs}}',
	comment:
		'Short label in the sidebar navigation Relay button. Preserve {displayedUnreadDmCount}; it is inserted by code.',
});
const FRIEND_REQUESTS_DESCRIPTOR = msg({
	message: '{displayedIncomingFriendRequestCount, plural, one {# friend request} other {# friend requests}}',
	comment:
		'Sidebar Relay-home button tooltip showing how many incoming friend requests are pending. Count is interpolated.',
});
const FRIENDS_DESCRIPTOR = msg({
	message: 'Friends',
	comment: 'Sidebar home button tooltip when the instance turns direct messages off but keeps friends.',
});
const HOME_DESCRIPTOR = msg({
	message: 'Home',
	comment:
		'Sidebar home button tooltip when the instance turns off direct messages, friend requests and personal notes.',
});
export const RelayButton = observer(() => {
	const {i18n} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef]);
	const contextMenuOpen = useContextMenuHoverState(buttonRef, !MobileLayout.enabled);
	const location = useLocation();
	const isSelected =
		!Routes.isGuildChannelRoute(location.pathname) &&
		!Routes.isFavoritesRoute(location.pathname) &&
		!Routes.isDiscoverRoute(location.pathname);
	const selectedChannel = SelectedChannel.selectedChannelIds.get(ME);
	const inlineDmsCollapsed = SidebarPreferences.inlineDmsCollapsed;
	const showCollapsedUnreadDmsBadge = SidebarPreferences.showCollapsedUnreadDmsBadge;
	const showIncomingFriendRequestBadge = SidebarPreferences.showIncomingFriendRequestBadge;
	const dmChannels = Channels.dmChannels;
	const readStateVersion = ReadStates.version;
	const relationships = Relationships.getRelationships();
	const incomingFriendRequestCount = Object.values(relationships).filter(
		({type}) => type === RelationshipTypes.INCOMING_REQUEST,
	).length;
	const unreadDmCount = useMemo(() => {
		if (!inlineDmsCollapsed || !showCollapsedUnreadDmsBadge) return 0;
		let count = 0;
		for (const channel of dmChannels) {
			if (ReadStates.hasUnread(channel.id)) count++;
		}
		return count;
	}, [dmChannels, inlineDmsCollapsed, readStateVersion, showCollapsedUnreadDmsBadge]);
	const badgeCount = getRelayButtonBadgeCount({
		incomingFriendRequestCount,
		inlineDmsCollapsed,
		showCollapsedUnreadDmsBadge,
		showIncomingFriendRequestBadge,
		unreadDmCount,
	});
	const displayedUnreadDmCount = inlineDmsCollapsed && showCollapsedUnreadDmsBadge ? unreadDmCount : 0;
	const displayedIncomingFriendRequestCount = showIncomingFriendRequestBadge ? incomingFriendRequestCount : 0;
	let homeDescriptor = DIRECT_MESSAGES_DESCRIPTOR;
	if (RuntimeConfig.directMessagesDisabled && !RuntimeConfig.friendsDisabled) {
		homeDescriptor = FRIENDS_DESCRIPTOR;
	} else if (RuntimeConfig.directMessagesDisabled && RuntimeConfig.personalNotesEnabled) {
		homeDescriptor = PERSONAL_NOTES_DESCRIPTOR;
	} else if (RuntimeConfig.directMessagesDisabled) {
		homeDescriptor = HOME_DESCRIPTOR;
	}
	const directMessagesLabel = useMemo(() => {
		const parts = [i18n._(homeDescriptor)];
		if (displayedUnreadDmCount > 0) {
			parts.push(i18n._(UNREAD_DMS_DESCRIPTOR, {displayedUnreadDmCount}));
		}
		if (displayedIncomingFriendRequestCount > 0) {
			parts.push(i18n._(FRIEND_REQUESTS_DESCRIPTOR, {displayedIncomingFriendRequestCount}));
		}
		return parts.join(', ');
	}, [displayedIncomingFriendRequestCount, displayedUnreadDmCount, homeDescriptor, i18n.locale]);
	const handleSelect = () => {
		const isMobile = MobileLayout.isMobileLayout();
		const route = (() => {
			if (isMobile) return Routes.HOME_DASHBOARD;
			if (selectedChannel && !RuntimeConfig.directMessagesDisabled && location.pathname !== Routes.HOME_DASHBOARD) {
				return Routes.dmChannel(selectedChannel);
			}
			return Routes.HOME_DASHBOARD;
		})();
		RouterUtils.transitionTo(route);
	};
	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		if (MobileLayout.isMobileLayout()) return;
		ContextMenuCommands.openFromEvent(event, (props) => (
			<RelayButtonContextMenu
				onClose={props.onClose}
				data-flx="app.sidebar-nav.orvix-button.handle-context-menu.orvix-button-context-menu"
			/>
		));
	}, []);
	const shouldShowHoverState = isHovering || contextMenuOpen;
	const indicatorTarget = resolveGuildListIndicatorBarTarget({isSelected, showHoverState: shouldShowHoverState});
	const isActive = shouldShowHoverState || isSelected;
	return (
		<Tooltip
			position="right"
			size="large"
			text={i18n._(homeDescriptor)}
			data-flx="app.sidebar-nav.orvix-button.tooltip"
		>
			<FocusRing
				offset={-2}
				focusTarget={buttonRef}
				ringTarget={iconRef}
				data-flx="app.sidebar-nav.orvix-button.focus-ring"
			>
				<button
					type="button"
					className={clsx(styles.relayButton, contextMenuOpen && styles.contextMenuHover)}
					aria-label={directMessagesLabel}
					aria-current={isSelected ? 'page' : undefined}
					data-guild-list-focus-item="true"
					onClick={handleSelect}
					onContextMenu={handleContextMenu}
					ref={mergedButtonRef}
					data-flx="app.sidebar-nav.orvix-button.orvix-button.select"
				>
					<AnimatePresence data-flx="app.sidebar-nav.orvix-button.animate-presence">
						{(isSelected || shouldShowHoverState) && (
							<div className={styles.guildIndicator} data-flx="app.sidebar-nav.orvix-button.guild-indicator">
								<motion.span
									className={styles.guildIndicatorBar}
									initial={false}
									animate={indicatorTarget}
									exit={{opacity: 0, height: 0}}
									transition={{duration: 0.2, ease: [0.25, 0.1, 0.25, 1]}}
									data-flx="app.sidebar-nav.orvix-button.guild-indicator-bar"
								/>
							</div>
						)}
					</AnimatePresence>
					<div className={styles.relative} data-flx="app.sidebar-nav.orvix-button.relative">
						<motion.div
							ref={iconRef}
							className={clsx(styles.relayButtonIcon, isSelected && styles.relayButtonIconSelected)}
							animate={{borderRadius: isActive ? '30%' : '50%'}}
							initial={false}
							transition={{duration: 0.07, ease: 'easeOut'}}
							data-flx="app.sidebar-nav.orvix-button.orvix-button-icon"
						>
							<RelayIcon
								className={styles.messageBubbleIcon}
								data-flx="app.sidebar-nav.orvix-button.relay-icon"
							/>
						</motion.div>
						<div
							className={clsx(styles.guildBadge, badgeCount > 0 && styles.guildBadgeActive)}
							data-flx="app.sidebar-nav.orvix-button.guild-badge"
						>
							<MentionBadgeAnimated
								mentionCount={badgeCount}
								size="small"
								data-flx="app.sidebar-nav.orvix-button.mention-badge-animated"
							/>
						</div>
					</div>
				</button>
			</FocusRing>
		</Tooltip>
	);
});
