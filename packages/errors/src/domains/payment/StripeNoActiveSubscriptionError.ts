// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeNoActiveSubscriptionError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_NO_ACTIVE_SUBSCRIPTION,
			status: 400,
		});
	}
}
