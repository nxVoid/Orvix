// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class NoUsersWithRelaytagError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.NO_USERS_WITH_ORVIXTAG_EXIST,
		});
	}
}
