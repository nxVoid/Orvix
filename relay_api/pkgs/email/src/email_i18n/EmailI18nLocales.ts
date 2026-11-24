// SPDX-License-Identifier: AGPL-3.0-or-later

import type {EmailTemplate, EmailTemplateKey} from '@pkgs/email/src/email_i18n/EmailI18nTypes.generated';
import {loadStaticLocaleFiles} from '@relay/i18n/src/runtime/StaticLocaleFiles';

export const EMAIL_I18N_LOCALE_MESSAGES = loadStaticLocaleFiles<Partial<Record<EmailTemplateKey, EmailTemplate>>>(
	'email',
	new URL('./weblate/locales/', import.meta.url),
);
