// SPDX-License-Identifier: AGPL-3.0-or-later

export const PRODUCT_NAME = 'Relay';
const LEGACY_PRODUCT_NAMES = new Set(['orvix', 'fluxer']);

/** Presentation only: never use this function for keys, identifiers or authentication. */
export function productDisplayName(value?: string | null): string {
	const name = value?.trim();
	return !name || LEGACY_PRODUCT_NAMES.has(name.toLowerCase()) ? PRODUCT_NAME : name;
}
