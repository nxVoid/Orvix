// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeSubscriptionNotCancelingError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_SUBSCRIPTION_NOT_CANCELING,
			status: 400,
		});
	}
}
