// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {NotFoundError} from '@relay/errors/src/domains/core/NotFoundError';

export class AppAttestNotAvailableError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.APP_ATTEST_NOT_AVAILABLE});
	}
}
