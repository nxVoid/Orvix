// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValidationErrorCode} from '@relay/constants/src/ValidationErrorCodes';
import type {ValidationErrorItem} from '@relay/schema/src/domains/common/ErrorSchemas';

export interface ValidationError extends ValidationErrorItem {
	code?: ValidationErrorCode;
}
