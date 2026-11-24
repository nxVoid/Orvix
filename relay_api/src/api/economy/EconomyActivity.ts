// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import {Logger} from '@app/api/Logger';
import type {Message} from '@app/api/models/Message';
import type {User} from '@app/api/models/User';
import {isProfileHidden} from '@app/api/user/ProfileVisibility';
import {MessageTypes} from '@relay/constants/src/ChannelConstants';
import {meaningfulMessage} from './EconomyPolicy';
import {getEconomy} from './EconomyRuntime';
import {notifyEconomyUpdate} from './EconomyUpdates';

function eligible(user: User): boolean {
	return Config.database.backend === 'postgres' && !user.isBot && !user.isSystem && !isProfileHidden(user);
}

/** A session has already been persisted and passed all sign-in checks. */
export async function recordEconomySignIn(user: User, now: Date): Promise<void> {
	if (!eligible(user)) return;
	try {
		const recorded = await (await getEconomy()).recordEvent(
			String(user.id),
			`login:${now.toISOString().slice(0, 10)}`,
			'login',
		);
		if (recorded) notifyEconomyUpdate(String(user.id));
	} catch (error) {
		Logger.warn(
			{errorName: error instanceof Error ? error.name : 'unknown'},
			'Relay Points sign-in activity was not recorded',
		);
	}
}

/** Only delivered, persisted human guild messages reach this hook. */
export async function recordEconomyMessage(user: User, message: Message): Promise<void> {
	if (!eligible(user) || message.type !== MessageTypes.DEFAULT || !message.content) return;
	const hash = meaningfulMessage(message.content);
	if (!hash) return;
	try {
		const recorded = await (await getEconomy()).recordEvent(
			String(user.id),
			`message:${message.channelId}:${message.id}`,
			'message',
			1,
			hash,
		);
		if (recorded) notifyEconomyUpdate(String(user.id));
	} catch (error) {
		Logger.warn(
			{errorName: error instanceof Error ? error.name : 'unknown'},
			'Relay Points message activity was not recorded',
		);
	}
}

export async function revokeEconomyMessages(messages: ReadonlyArray<Message>): Promise<void> {
	if (Config.database.backend !== 'postgres') return;
	const byAuthor = new Map<string, Array<string>>();
	for (const message of messages) {
		if (!message.authorId || message.type !== MessageTypes.DEFAULT) continue;
		const author = String(message.authorId);
		const ids = byAuthor.get(author) ?? [];
		ids.push(`${message.channelId}:${message.id}`);
		byAuthor.set(author, ids);
	}
	if (!byAuthor.size) return;
	try {
		const economy = await getEconomy();
		for (const [author, ids] of byAuthor) {
			if (await economy.revokeMessages(author, ids)) notifyEconomyUpdate(author);
		}
	} catch (error) {
		Logger.warn(
			{errorName: error instanceof Error ? error.name : 'unknown'},
			'Relay Points message activity was not revoked',
		);
	}
}
