// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import {productDisplayName} from '@relay/constants/src/BrandingConstants';

let cachedProductName: string | null = null;

export function getDefaultProductName(): string {
	return productDisplayName(Config.instance.branding.productName);
}

export function getInstanceProductName(): string {
	return productDisplayName(cachedProductName ?? getDefaultProductName());
}

export function setCachedProductName(productName: string | null): void {
	cachedProductName = productName;
}
