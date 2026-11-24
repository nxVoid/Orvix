// SPDX-License-Identifier: AGPL-3.0-or-later

import {HttpStatus} from '@relay/constants/src/HttpConstants';
import {RelayError, type RelayErrorStatus} from '@relay/errors/src/RelayError';

export const KVClientErrorCode = {
	INVALID_ARGUMENT: 'KV_CLIENT_INVALID_ARGUMENT',
	INVALID_RESPONSE: 'KV_CLIENT_INVALID_RESPONSE',
	REQUEST_FAILED: 'KV_CLIENT_REQUEST_FAILED',
	TIMEOUT: 'KV_CLIENT_TIMEOUT',
} as const;

interface KVClientErrorInit {
	code: string;
	message: string;
	status?: RelayErrorStatus;
}

export class KVClientError extends RelayError {
	constructor(init: KVClientErrorInit) {
		super({
			code: init.code,
			message: init.message,
			status: init.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
		});
		this.name = 'KVClientError';
	}
}

export function createInvalidResponseError(command: string, expected: string): KVClientError {
	return new KVClientError({
		code: KVClientErrorCode.INVALID_RESPONSE,
		message: `KV request returned an invalid response (${command}): expected ${expected}`,
	});
}
