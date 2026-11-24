// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeNoPurchaseHistoryError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_NO_PURCHASE_HISTORY,
			status: 400,
		});
	}
}
