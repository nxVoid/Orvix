// SPDX-License-Identifier: AGPL-3.0-or-later

import type {EmailMessage, IEmailProvider} from '@pkgs/email/src/EmailProviderTypes';
import {createLogger} from '@relay/logger/src/Logger';

const logger = createLogger('@pkgs/email/src/DomainRoutedEmailProvider');

export class DomainRoutedEmailProvider implements IEmailProvider {
	private readonly primary: IEmailProvider;
	private readonly fallback: IEmailProvider;
	private readonly fallbackDomains: ReadonlySet<string>;

	constructor(primary: IEmailProvider, fallback: IEmailProvider, fallbackDomains: ReadonlyArray<string>) {
		this.primary = primary;
		this.fallback = fallback;
		this.fallbackDomains = new Set(fallbackDomains);
	}

	async sendEmail(message: EmailMessage): Promise<boolean> {
		const domain = message.to
			.slice(message.to.lastIndexOf('@') + 1)
			.trim()
			.toLowerCase();
		const useFallback = this.fallbackDomains.has('*') || this.fallbackDomains.has(domain);
		logger.debug({domain, provider: useFallback ? 'fallback' : 'primary'}, 'Routing email');
		return (useFallback ? this.fallback : this.primary).sendEmail(message);
	}
}
