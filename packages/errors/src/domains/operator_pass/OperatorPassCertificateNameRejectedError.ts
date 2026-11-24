// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';

export class OperatorPassCertificateNameRejectedError extends BadRequestError {
	constructor(index?: number) {
		super({
			code: APIErrorCodes.OPERATOR_PASS_CERTIFICATE_NAME_REJECTED,
			data: index === undefined ? undefined : {index},
		});
	}
}
