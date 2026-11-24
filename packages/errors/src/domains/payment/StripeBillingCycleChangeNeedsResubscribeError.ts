// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeBillingCycleChangeNeedsResubscribeError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_BILLING_CYCLE_CHANGE_NEEDS_RESUBSCRIBE,
			status: 400,
		});
	}
}
