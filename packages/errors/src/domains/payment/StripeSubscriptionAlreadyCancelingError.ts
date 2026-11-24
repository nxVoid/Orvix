// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeSubscriptionAlreadyCancelingError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_SUBSCRIPTION_ALREADY_CANCELING,
			status: 400,
		});
	}
}
