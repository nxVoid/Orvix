// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ConflictError} from '@relay/errors/src/domains/core/ConflictError';

export class OperatorPassWithdrawalUnavailableError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.OPERATOR_PASS_WITHDRAWAL_UNAVAILABLE});
	}
}
