// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {ConflictError} from '@relay/errors/src/domains/core/ConflictError';

export class EnforcementDecisionOwnsStateError extends ConflictError {
	constructor(decisionId: bigint) {
		super({code: APIErrorCodes.ENFORCEMENT_DECISION_OWNS_STATE, data: {decision_id: decisionId.toString()}});
	}
}
