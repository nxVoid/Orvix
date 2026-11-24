// SPDX-License-Identifier: AGPL-3.0-or-later

import {AuthSessionStorageKey} from '@app/features/platform/state/auth_session/AuthSessionStorage';

export const AppStorageKey = Object.freeze({
	ACCESSIBILITY_LEGACY_STORE: 'Accessibility',
	ACCOUNT_KEYBINDS: 'AccountKeybinds',
	ACCOUNT_RESET_KEPT_KEYS: 'orvix:internal:account-reset-kept-keys',
	ACCOUNT_THEME: 'AccountTheme',
	ACCOUNT_THEME_MODE: 'AccountThemeMode',
	AUTH_ACCOUNT_KEY: AuthSessionStorageKey.ActiveAccountKey,
	AUTH_DESKTOP_CLIENT_INTRO_COMPLETED: 'orvix:auth:desktop-client-intro:completed',
	AUTH_DESKTOP_CLIENT_PERMISSIONS_SKIPPED: 'orvix:auth:desktop-client-intro:permissions-skipped',
	AUTH_DESKTOP_CLIENT_PREFERENCES_SEEN: 'orvix:auth:desktop-client-intro:preferences-seen',
	AUTH_DESKTOP_CLIENT_WELCOME_SEEN: 'orvix:auth:desktop-client-intro:welcome-seen',
	AUTH_SESSION_TOKEN: AuthSessionStorageKey.Token,
	AUTH_SESSION_USER_ID: AuthSessionStorageKey.UserId,
	DELETED_KEYS: 'orvix:internal:deleted-keys',
	I18N_CHOSEN_LOCALE: 'orvix:i18n:chosen-locale',
	INSTALLATION_THEME: 'InstallationTheme',
	MESSAGING_DRAFTS: 'Drafts',
	MESSAGING_MESSAGE_EDIT: 'MessageEdit',
	NOTIFICATION: 'Notification',
	QUICK_CSS_EDITOR_HISTORY: 'QuickCssEditor:history:v1',
	QUICK_CSS_EDITOR_PANEL_LAYOUT: 'QuickCssEditor:panelLayout',
	QUICK_CSS_EDITOR_PLACEMENT: 'QuickCssEditor:placement',
	QUICK_CSS_EDITOR_PREFERENCES: 'QuickCssEditor:preferences',
	SSO_PENDING_CONTEXT_PREFIX: 'orvix:sso:pending-context',
	THEME: 'Theme',
	THEME_LIBRARY_ACCOUNT_ENABLED_IDS: 'orvix:theme-library:account-enabled-ids',
	THEME_LIBRARY_ENABLED_IDS: 'orvix:theme-library:enabled-ids',
	THEME_LIBRARY_FOLDERS: 'orvix:theme-library:folders',
	THEME_LIBRARY_LOCAL_FILES: 'orvix:theme-library:local-files',
	THEME_LIBRARY_MIGRATED: 'orvix:theme-library:migrated-to-app-storage',
	THEME_LIBRARY_THEMES: 'orvix:theme-library:themes',
	THEME_PREBOOT_MIRROR: 'theme',
	THEME_PROFILES_MIGRATED: 'ThemeProfiles:migrated:v1',
	UI_CHANNEL_PINS_POPOUT_SIZE: 'orvix:ui:channel-pins-popout-size',
	UI_EXPRESSION_PICKER_SIZE: 'orvix:ui:expression-picker-size',
	UI_INBOX_OTHER_ACCOUNTS_COLLAPSED: 'orvix:ui:inbox-other-accounts-collapsed',
	UI_INBOX_POPOUT_SIZE: 'orvix:ui:inbox-popout-size',
	UI_SIDEBAR_WIDTH: 'orvix:ui:sidebar-width',
	VOICE_SETTINGS: 'VoiceSettings',
	WINDOWS_FONT: 'WindowsFont',
} as const);

export type AppStorageKey = (typeof AppStorageKey)[keyof typeof AppStorageKey];

export const LEGACY_APP_STORAGE_MIGRATION_MARKER_KEY = 'orvix:migration:legacy-app-storage';
export const LEGACY_SHARED_CONTENT_REVIEW_KEY = 'orvix:migration:shared-content-review';

export const LegacySharedContentReviewState = Object.freeze({
	PENDING: 'pending',
	DONE: 'done',
} as const);

const GLOBAL_APP_STORAGE_KEY_LOOKUP: Readonly<Record<string, true>> = Object.freeze({
	[AppStorageKey.ACCOUNT_KEYBINDS]: true,
	[AppStorageKey.AUTH_ACCOUNT_KEY]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_INTRO_COMPLETED]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_PERMISSIONS_SKIPPED]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_PREFERENCES_SEEN]: true,
	[AppStorageKey.AUTH_DESKTOP_CLIENT_WELCOME_SEEN]: true,
	[AppStorageKey.AUTH_SESSION_TOKEN]: true,
	[AppStorageKey.AUTH_SESSION_USER_ID]: true,
	[AppStorageKey.I18N_CHOSEN_LOCALE]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_HISTORY]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PANEL_LAYOUT]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PLACEMENT]: true,
	[AppStorageKey.QUICK_CSS_EDITOR_PREFERENCES]: true,
	[AppStorageKey.INSTALLATION_THEME]: true,
	[AppStorageKey.THEME_LIBRARY_ENABLED_IDS]: true,
	[AppStorageKey.THEME_LIBRARY_FOLDERS]: true,
	[AppStorageKey.THEME_LIBRARY_LOCAL_FILES]: true,
	[AppStorageKey.THEME_LIBRARY_MIGRATED]: true,
	[AppStorageKey.THEME_LIBRARY_THEMES]: true,
	[AppStorageKey.THEME_PROFILES_MIGRATED]: true,
	[AppStorageKey.UI_INBOX_OTHER_ACCOUNTS_COLLAPSED]: true,
	[AppStorageKey.WINDOWS_FONT]: true,
});

function keyStartsWithPrefix(key: string, prefix: AppStorageKey): boolean {
	return key.startsWith(`${prefix}:`);
}

export function ssoPendingContextKey(state: string): string {
	return `${AppStorageKey.SSO_PENDING_CONTEXT_PREFIX}:${encodeURIComponent(state)}`;
}

export function isSsoPendingContextKey(key: string): boolean {
	return keyStartsWithPrefix(key, AppStorageKey.SSO_PENDING_CONTEXT_PREFIX);
}

export function isGlobalAppStorageKey(key: string): boolean {
	return Object.hasOwn(GLOBAL_APP_STORAGE_KEY_LOOKUP, key) || isSsoPendingContextKey(key);
}
