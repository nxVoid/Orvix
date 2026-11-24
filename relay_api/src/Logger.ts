// SPDX-License-Identifier: AGPL-3.0-or-later

import {createLogger, type Logger as RelayLogger} from '@relay/logger/src/Logger';

export const Logger = createLogger('relay-api');

export type Logger = RelayLogger;
