// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeWebhookNotAvailableError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_WEBHOOK_NOT_AVAILABLE,
			status: 400,
		});
	}
}
