// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ConflictError} from '@relay/errors/src/domains/core/ConflictError';

export class EnforcementDeletionStartedError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.ENFORCEMENT_DELETION_STARTED});
	}
}
