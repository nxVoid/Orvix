// SPDX-License-Identifier: AGPL-3.0-or-later

import {statusError} from '@relay/errors/src/RelayError';

export class NotFoundError extends statusError(404) {}
