// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ConflictError} from '@relay/errors/src/domains/core/ConflictError';

export class AccountIdentityLockedError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.ACCOUNT_IDENTITY_LOCKED});
	}
}
