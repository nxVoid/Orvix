// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StripeError extends RelayError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.STRIPE_ERROR,
			status: 400,
			data: detail ? {detail} : undefined,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
