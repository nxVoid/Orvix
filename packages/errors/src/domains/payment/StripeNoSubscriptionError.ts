// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeNoSubscriptionError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_NO_SUBSCRIPTION,
			status: 400,
		});
	}
}
