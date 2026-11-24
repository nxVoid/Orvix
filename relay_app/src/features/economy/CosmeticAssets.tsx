// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import type {ProfileCosmeticResponse} from '@relay/schema/src/domains/user/UserResponseSchemas';
import {useEffect, useState} from 'react';

export function economyAssetUrl(path: string) {
	if (!/^\/economy\/assets\/[a-z0-9_-]+\.(?:svg|webp)$/u.test(path)) return undefined;
	return `${RuntimeConfig.transportApiEndpoint}/v${RuntimeConfig.apiCodeVersion}${path}`;
}

export function useCosmeticUrl(item?: Pick<ProfileCosmeticResponse, 'asset' | 'static_asset'>, staticOnly = false) {
	const [reduced, setReduced] = useState(
		() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	);
	useEffect(() => {
		if (!item || staticOnly) return;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setReduced(media.matches);
		media.addEventListener('change', update);
		update();
		return () => media.removeEventListener('change', update);
	}, [item, staticOnly]);
	return item ? economyAssetUrl(reduced || staticOnly ? item.static_asset : item.asset) : undefined;
}
