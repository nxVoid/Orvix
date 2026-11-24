// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {BadRequestError} from '@relay/errors/src/domains/core/BadRequestError';
import type {RelayErrorData} from '@relay/errors/src/RelayError';

export class CaptchaRequiredError extends BadRequestError {
	constructor(data?: RelayErrorData) {
		super({code: APIErrorCodes.CAPTCHA_REQUIRED, data});
		this.name = 'CaptchaRequiredError';
	}
}

export class InvalidCaptchaError extends BadRequestError {
	constructor(data?: RelayErrorData) {
		super({code: APIErrorCodes.INVALID_CAPTCHA, data});
		this.name = 'InvalidCaptchaError';
	}
}
