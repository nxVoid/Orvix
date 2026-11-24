// SPDX-License-Identifier: AGPL-3.0-or-later

import {http} from '@app/features/platform/transport/RestTransport';
import {ResettableStates} from '@app/features/app/state/ResettableStates';
import type {RegisteredApplicationCommand} from '@relay/schema/src/domains/bot/ApplicationCommandSchemas';
import {makeAutoObservable, runInAction} from 'mobx';

class ApplicationCommands {
	byChannel = new Map<string, Array<RegisteredApplicationCommand>>();
	constructor() {
		makeAutoObservable(this);
	}
	async fetch(channelId: string): Promise<void> {
		try {
			const response = await http.get<Array<RegisteredApplicationCommand>>(
				`/channels/${channelId}/application-commands`,
			);
			runInAction(() => this.byChannel.set(channelId, response.body));
		} catch {
			runInAction(() => this.byChannel.delete(channelId));
		}
	}
	find(channelId: string, name: string): RegisteredApplicationCommand | undefined {
		const matches = (this.byChannel.get(channelId) ?? []).filter((command) => `/${command.name}` === name);
		// Never silently invoke a different application when names collide.
		return matches.length === 1 ? matches[0] : undefined;
	}
	async invoke(channelId: string, name: string, options: Record<string, string>): Promise<void> {
		const command = this.find(channelId, name);
		if (!command) throw new Error('Bot command is unavailable or ambiguous. Refresh the channel.');
		await http.post(`/channels/${channelId}/interactions`, {
			body: {application_id: command.application_id, name: command.name, options},
		});
	}
	reset() {
		this.byChannel.clear();
	}
}
const applicationCommands = new ApplicationCommands();
ResettableStates.register(applicationCommands, () => applicationCommands.reset());
export default applicationCommands;
