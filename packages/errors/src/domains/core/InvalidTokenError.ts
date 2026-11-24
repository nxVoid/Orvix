// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class InvalidTokenError extends RelayError {
	constructor() {
		super({code: APIErrorCodes.INVALID_TOKEN, status: 401});
	}
}
