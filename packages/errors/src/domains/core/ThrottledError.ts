// SPDX-License-Identifier: AGPL-3.0-or-later

import {sanitizeRetryAfterSeconds} from '@relay/errors/src/domains/core/RetryAfterSeconds';
import {RelayError, type RelayErrorData} from '@relay/errors/src/RelayError';

export class ThrottledError extends RelayError {
	constructor({
		code,
		message,
		retryAfterSeconds,
		data,
		headers,
		messageVariables,
	}: {
		code: string;
		message?: string;
		retryAfterSeconds: number;
		data?: RelayErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({
			code,
			message,
			status: 429,
			data,
			headers: {...headers, 'Retry-After': sanitizeRetryAfterSeconds(retryAfterSeconds).toString()},
			messageVariables,
		});
	}
}
