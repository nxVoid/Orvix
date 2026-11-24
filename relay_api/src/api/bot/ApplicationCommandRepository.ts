// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApplicationID, GuildID} from '@app/api/BrandedTypes';
import {fetchMany, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {defineTable} from '@app/api/database/CassandraTableDsl';
import {
	ApplicationCommandsRequest,
	type ApplicationCommand,
} from '@relay/schema/src/domains/bot/ApplicationCommandSchemas';

// A logical table in the existing PostgreSQL KV store; no physical PostgreSQL DDL changes.
interface CommandRow {
	guild_id: GuildID;
	application_id: ApplicationID;
	commands_json: string;
}
const Commands = defineTable<CommandRow, 'guild_id' | 'application_id'>({
	name: 'application_guild_commands',
	primaryKey: ['guild_id', 'application_id'],
	columns: ['guild_id', 'application_id', 'commands_json'],
});
export async function putApplicationCommands(
	guildId: GuildID,
	applicationId: ApplicationID,
	commands: Array<ApplicationCommand>,
): Promise<void> {
	await upsertOne(
		Commands.upsertAll({guild_id: guildId, application_id: applicationId, commands_json: JSON.stringify(commands)}),
	);
}
export async function listApplicationCommands(guildId: GuildID) {
	const rows = await fetchMany<CommandRow>(
		Commands.select({where: Commands.where.eq('guild_id')}).bind({guild_id: guildId}),
	);
	return rows.flatMap((row) =>
		ApplicationCommandsRequest.parse(JSON.parse(row.commands_json)).map((command) => ({
			...command,
			application_id: row.application_id.toString(),
		})),
	);
}
