// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ServiceUnavailableError} from '@relay/errors/src/domains/core/ServiceUnavailableError';

export class StoreBillingUnavailableError extends ServiceUnavailableError {
	constructor() {
		super({
			code: APIErrorCodes.STORE_BILLING_UNAVAILABLE,
		});
	}
}
