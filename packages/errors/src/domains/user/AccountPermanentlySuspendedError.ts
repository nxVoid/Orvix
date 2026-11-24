// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@relay/errors/src/domains/core/ForbiddenError';
import type {EnforcementNotice} from '@relay/schema/src/domains/auth/EnforcementNoticeSchemas';

export class AccountPermanentlySuspendedError extends ForbiddenError {
	constructor(notice: EnforcementNotice | null) {
		super({code: APIErrorCodes.ACCOUNT_SUSPENDED_PERMANENTLY, data: {notice}});
	}
}
