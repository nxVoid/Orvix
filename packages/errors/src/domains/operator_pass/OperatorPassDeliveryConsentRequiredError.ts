// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class OperatorPassDeliveryConsentRequiredError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.OPERATOR_PASS_DELIVERY_CONSENT_REQUIRED});
	}
}
