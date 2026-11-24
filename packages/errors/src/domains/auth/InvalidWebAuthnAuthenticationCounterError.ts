// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {InternalServerError} from '@relay/errors/src/domains/core/InternalServerError';

export class InvalidWebAuthnAuthenticationCounterError extends InternalServerError {
	constructor() {
		super({code: APIErrorCodes.INVALID_WEBAUTHN_AUTHENTICATION_COUNTER});
	}
}
