// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {MAX_CONNECTIONS_PER_USER} from '@relay/constants/src/ConnectionConstants';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class ConnectionLimitReachedError extends BadRequestError {
	constructor(limit: number = MAX_CONNECTIONS_PER_USER) {
		super({
			code: APIErrorCodes.CONNECTION_LIMIT_REACHED,
			messageVariables: {limit},
		});
	}
}
