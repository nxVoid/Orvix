// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class FollowTargetNotAgeRestrictedError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.FOLLOW_TARGET_NOT_AGE_RESTRICTED,
		});
	}
}
