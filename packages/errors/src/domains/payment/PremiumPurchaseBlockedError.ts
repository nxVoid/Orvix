// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@relay/errors/src/domains/core/ForbiddenError';
import type {RelayErrorData} from '@relay/errors/src/RelayError';

type PremiumPurchaseBlockedReason = 'lifetime' | 'existing_subscription' | 'purchase_disabled' | 'payment_dispute_open';

type PremiumPurchaseBlockingProvider = 'stripe' | 'app_store' | 'google_play';

interface PremiumPurchaseBlockedData extends RelayErrorData {
	provider?: PremiumPurchaseBlockingProvider;
}

export class PremiumPurchaseBlockedError extends ForbiddenError {
	constructor(reason: PremiumPurchaseBlockedReason = 'purchase_disabled', data: PremiumPurchaseBlockedData = {}) {
		super({
			code: APIErrorCodes.PREMIUM_PURCHASE_BLOCKED,
			data: {
				...data,
				reason,
			},
		});
	}
}
