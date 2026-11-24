// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {NotFoundError} from '@relay/errors/src/domains/core/NotFoundError';

export class GuildVisitNotFoundError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.GUILD_VISIT_NOT_FOUND});
	}
}
