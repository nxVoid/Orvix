// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class ThreadLockedError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.THREAD_LOCKED,
		});
	}
}
