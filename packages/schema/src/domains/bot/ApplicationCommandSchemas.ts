// SPDX-License-Identifier: AGPL-3.0-or-later

import {SnowflakeType} from '@relay/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const Name = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
export const ApplicationCommandOption = z.object({
	name: Name,
	description: z.string().min(1).max(100),
	type: z.enum(['string', 'integer', 'user', 'channel', 'boolean']),
	required: z.boolean().default(false),
});
export const ApplicationCommand = z
	.object({
		name: Name,
		description: z.string().min(1).max(100),
		default_member_permissions: z
			.string()
			.regex(/^\d{1,20}$/)
			.default('0'),
		options: z.array(ApplicationCommandOption).max(10).default([]),
	})
	.refine((command) => new Set(command.options.map((option) => option.name)).size === command.options.length, {
		message: 'Option names must be unique',
	});
export const ApplicationCommandsRequest = z
	.array(ApplicationCommand)
	.max(100)
	.refine((commands) => new Set(commands.map((command) => command.name)).size === commands.length, {
		message: 'Command names must be unique',
	});
export const RegisteredApplicationCommand = ApplicationCommand.safeExtend({application_id: SnowflakeType});
export const ApplicationCommandsResponse = z.array(RegisteredApplicationCommand);
export const ApplicationGuildCommandsParam = z.object({application_id: SnowflakeType, guild_id: SnowflakeType});
export const InteractionCreateRequest = z.object({
	application_id: SnowflakeType,
	name: Name,
	options: z.record(z.string(), z.string().max(2000)).default({}),
});
export const InteractionIdParam = z.object({interaction_id: z.string().uuid()});
export const InteractionCreatedResponse = z.object({id: z.string().uuid()});
export type ApplicationCommand = z.infer<typeof ApplicationCommand>;
export type RegisteredApplicationCommand = Omit<z.infer<typeof RegisteredApplicationCommand>, 'application_id'> & {
	application_id: string;
};
