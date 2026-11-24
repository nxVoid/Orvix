// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {OAuth2Error} from '@relay/errors/src/domains/auth/OAuth2Error';

export class InvalidPermissionsNegativeError extends OAuth2Error {
	constructor() {
		super({error: 'invalid_request', errorDescription: APIErrorCodes.INVALID_PERMISSIONS_NEGATIVE, status: 400});
	}
}
