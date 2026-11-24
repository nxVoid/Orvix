// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class RegistrationCredentialsRequiredError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.REGISTRATION_CREDENTIALS_REQUIRED});
		this.name = 'RegistrationCredentialsRequiredError';
	}
}
