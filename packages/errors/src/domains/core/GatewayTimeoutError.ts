// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@relay/errors/src/RelayError';

export class GatewayTimeoutError extends defaultCodeStatusError(504, APIErrorCodes.GATEWAY_TIMEOUT) {}
