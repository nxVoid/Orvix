// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {RelayError} from '@relay/errors/src/RelayError';

export class StoreNotificationUnauthorizedError extends RelayError {
	constructor() {
		super({
			code: APIErrorCodes.STORE_NOTIFICATION_UNAUTHORIZED,
			status: 401,
		});
	}
}
