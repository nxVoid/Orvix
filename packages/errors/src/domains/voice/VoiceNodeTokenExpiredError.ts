// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {UnauthorizedError} from '@relay/errors/src/domains/core/UnauthorizedError';

export class VoiceNodeTokenExpiredError extends UnauthorizedError {
	constructor() {
		super({code: APIErrorCodes.VOICE_NODE_TOKEN_EXPIRED});
	}
}
