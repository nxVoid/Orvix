// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class AppAttestKeyNotRegisteredError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.APP_ATTEST_KEY_NOT_REGISTERED});
	}
}
