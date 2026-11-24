// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@relay/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@relay/errors/src/RelayError';

export class SsoProviderUnavailableError extends defaultCodeStatusError(503, APIErrorCodes.SSO_PROVIDER_UNAVAILABLE) {}
