// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {UnauthorizedError} from '@relay/errors/src/domains/core/UnauthorizedError';

export class VoiceJoinTokenInvalidError extends UnauthorizedError {
	constructor() {
		super({code: APIErrorCodes.VOICE_JOIN_TOKEN_INVALID});
	}
}
