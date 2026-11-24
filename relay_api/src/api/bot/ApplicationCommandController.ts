// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomUUID} from 'node:crypto';
import {createApplicationID, createChannelID, createGuildID, createUserID} from '@app/api/BrandedTypes';
import {listApplicationCommands, putApplicationCommands} from '@app/api/bot/ApplicationCommandRepository';
import {viewerFromCtx} from '@app/api/experiment/ChannelThreadsGate';
import {LoginRequired, BotOnly, DefaultUserOnly} from '@app/api/middleware/AuthMiddleware';
import {getApplicationRepository} from '@app/api/middleware/ServiceSingletons';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {assertAccountNotLimited} from '@app/api/user/AccountLimit';
import {Validator} from '@app/api/Validator';
import {Permissions} from '@relay/constants/src/ChannelConstants';
import {AccessDeniedError} from '@relay/errors/src/domains/core/AccessDeniedError';
import {MissingPermissionsError} from '@relay/errors/src/domains/core/MissingPermissionsError';
import {UnknownChannelError} from '@relay/errors/src/domains/channel/UnknownChannelError';
import {InputValidationError} from '@relay/errors/src/domains/core/InputValidationError';
import {ValidationErrorCodes} from '@relay/constants/src/ValidationErrorCodes';
import {ChannelIdParam} from '@relay/schema/src/domains/common/CommonParamSchemas';
import {
	ApplicationCommandsRequest,
	ApplicationCommandsResponse,
	ApplicationGuildCommandsParam,
	InteractionCreateRequest,
	InteractionIdParam,
	InteractionCreatedResponse,
	type RegisteredApplicationCommand,
} from '@relay/schema/src/domains/bot/ApplicationCommandSchemas';
import {MessageRequestSchema} from '@relay/schema/src/domains/message/MessageRequestSchemas';
import {MessageResponseSchema} from '@relay/schema/src/domains/message/MessageResponseSchemas';
import type {Context} from 'hono';

interface InteractionContext {
	botId: string;
	userId: string;
	channelId: string;
	guildId: string;
	requiredPermissions: string;
}
const LOCAL_COMMANDS = new Set([
	'shrug',
	'tableflip',
	'unflip',
	'me',
	'spoiler',
	'tts',
	'nick',
	'kick',
	'ban',
	'msg',
	'saved',
	'sticker',
	'gif',
]);

function invalidOptions(): never {
	throw InputValidationError.fromCode('options', ValidationErrorCodes.INVALID_FORMAT);
}
function validateOptions(command: RegisteredApplicationCommand, options: Record<string, string>): void {
	if (Object.keys(options).some((key) => !command.options.some((option) => option.name === key))) invalidOptions();
	for (const option of command.options) {
		const value = options[option.name];
		if (value === undefined) {
			if (option.required) invalidOptions();
			else continue;
		}
		if (!value.trim()) invalidOptions();
		if (option.type === 'integer' && !/^-?\d{1,15}$/.test(value)) invalidOptions();
		if ((option.type === 'user' || option.type === 'channel') && !/^\d{1,20}$/.test(value)) invalidOptions();
		if (option.type === 'boolean' && value !== 'true' && value !== 'false') invalidOptions();
	}
}
async function channelContext(ctx: Context<HonoEnv>, channelIdText: string) {
	const channelId = createChannelID(BigInt(channelIdText));
	const user = ctx.get('user');
	const channel = await ctx
		.get('channelService')
		.channelData.operations.getChannel({userId: user.id, viewer: viewerFromCtx(ctx), channelId});
	// Initial command support is for normal guild text channels. Threads require separate scoped permissions.
	if (!channel.guildId || channel.isThread() || channel.isThreadOnly()) throw new UnknownChannelError();
	const gateway = ctx.get('gatewayService');
	const permissions = await gateway.getUserPermissions({guildId: channel.guildId, channelId, userId: user.id});
	if (!(permissions & Permissions.VIEW_CHANNEL)) throw new MissingPermissionsError();
	return {channel, channelId, guildId: channel.guildId, permissions};
}
async function availableCommands(
	ctx: Context<HonoEnv>,
	guildId: ReturnType<typeof createGuildID>,
	channelId: ReturnType<typeof createChannelID>,
	permissions: bigint,
) {
	const gateway = ctx.get('gatewayService');
	const commands = await listApplicationCommands(guildId);
	const visible = await Promise.all(
		commands.map(async (command) => {
			const application = await getApplicationRepository().getApplication(
				createApplicationID(BigInt(command.application_id)),
			);
			if (!application?.botUserId) return null;
			const botMember = await gateway.getGuildMember({guildId, userId: application.botUserId});
			if (!botMember.success) return null;
			const required = BigInt(command.default_member_permissions);
			if ((permissions & required) !== required) return null;
			const botCanView = await gateway.checkPermission({
				guildId,
				channelId,
				userId: application.botUserId,
				permission: Permissions.VIEW_CHANNEL,
			});
			return botCanView ? {command, botId: application.botUserId} : null;
		}),
	);
	return visible.filter((item) => item !== null);
}

export function ApplicationCommandController(app: HonoApp) {
	app.put(
		'/applications/:application_id/guilds/:guild_id/commands',
		RateLimitMiddleware(RateLimitConfigs.BOT_COMMAND_REGISTER),
		LoginRequired,
		BotOnly,
		Validator('param', ApplicationGuildCommandsParam),
		Validator('json', ApplicationCommandsRequest),
		OpenAPI({
			operationId: 'replace_guild_application_commands',
			summary: 'Register guild bot commands',
			description: 'Replaces commands for the authenticated bot in a guild it belongs to.',
			responseSchema: ApplicationCommandsResponse,
			statusCode: 200,
			security: ['botToken'],
			tags: ['OAuth2'],
		}),
		async (ctx) => {
			const {application_id, guild_id} = ctx.req.valid('param');
			const applicationId = createApplicationID(application_id);
			const guildId = createGuildID(guild_id);
			const application = await getApplicationRepository().getApplication(applicationId);
			if (!application || application.botUserId !== ctx.get('user').id) throw new AccessDeniedError();
			await ctx.get('guildService').getGuildAuthenticated({userId: ctx.get('user').id, guildId});
			const commands = ctx.req.valid('json');
			if (commands.some((command) => LOCAL_COMMANDS.has(command.name))) invalidOptions();
			await putApplicationCommands(guildId, applicationId, commands);
			return ctx.json(commands.map((command) => ({...command, application_id: applicationId.toString()})));
		},
	);
	app.get(
		'/channels/:channel_id/application-commands',
		RateLimitMiddleware(RateLimitConfigs.BOT_COMMAND_LIST),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'list_channel_application_commands',
			summary: 'List available bot commands',
			description: 'Returns installed bot commands the caller may invoke in this channel.',
			responseSchema: ApplicationCommandsResponse,
			statusCode: 200,
			security: ['botToken', 'sessionToken'],
			tags: ['OAuth2'],
		}),
		async (ctx) => {
			const {channelId, guildId, permissions} = await channelContext(ctx, ctx.req.valid('param').channel_id.toString());
			return ctx.json((await availableCommands(ctx, guildId, channelId, permissions)).map((item) => item.command));
		},
	);
	app.post(
		'/channels/:channel_id/interactions',
		RateLimitMiddleware(RateLimitConfigs.BOT_INTERACTION_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		Validator('json', InteractionCreateRequest),
		OpenAPI({
			operationId: 'create_bot_interaction',
			summary: 'Invoke bot command',
			description:
				'Checks caller and bot channel permissions, validates options and dispatches INTERACTION_CREATE only to the bot.',
			responseSchema: InteractionCreatedResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['OAuth2'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			assertAccountNotLimited(user);
			const {channelId, guildId, permissions} = await channelContext(ctx, ctx.req.valid('param').channel_id.toString());
			if (!(permissions & Permissions.SEND_MESSAGES)) throw new MissingPermissionsError();
			const data = ctx.req.valid('json');
			const available = await availableCommands(ctx, guildId, channelId, permissions);
			const found = available.find(
				({command}) => command.application_id === data.application_id.toString() && command.name === data.name,
			);
			if (!found) throw new AccessDeniedError();
			validateOptions(found.command, data.options);
			const id = randomUUID();
			const cache = ctx.get('cacheService');
			await cache.set<InteractionContext>(
				`bot:interaction:${id}`,
				{
					botId: found.botId.toString(),
					userId: user.id.toString(),
					channelId: channelId.toString(),
					guildId: guildId.toString(),
					requiredPermissions: found.command.default_member_permissions,
				},
				60,
			);
			try {
				await ctx.get('gatewayService').dispatchPresence({
					userId: found.botId,
					event: 'INTERACTION_CREATE',
					data: {
						id,
						application_id: found.command.application_id,
						guild_id: guildId.toString(),
						channel_id: channelId.toString(),
						user: {id: user.id.toString(), username: user.username, avatar: user.avatarHash},
						member_permissions: permissions.toString(),
						data: {name: data.name, options: data.options},
					},
				});
			} catch (error) {
				await cache.delete(`bot:interaction:${id}`);
				throw error;
			}
			return ctx.json({id});
		},
	);
	app.post(
		'/interactions/:interaction_id/callback',
		RateLimitMiddleware(RateLimitConfigs.BOT_INTERACTION_CALLBACK),
		LoginRequired,
		BotOnly,
		Validator('param', InteractionIdParam),
		Validator('json', MessageRequestSchema.pick({content: true, embeds: true})),
		OpenAPI({
			operationId: 'respond_to_bot_interaction',
			summary: 'Respond to bot command',
			description:
				'Consumes a single-use 60-second interaction belonging to the authenticated bot and sends its response after rechecking permissions.',
			responseSchema: MessageResponseSchema,
			statusCode: 200,
			security: ['botToken'],
			tags: ['OAuth2'],
		}),
		async (ctx) => {
			const key = `bot:interaction:${ctx.req.valid('param').interaction_id}`;
			const cache = ctx.get('cacheService');
			const entry = await cache.get<InteractionContext>(key);
			if (!entry || entry.botId !== ctx.get('user').id.toString()) throw new AccessDeniedError();
			const permissions = await ctx
				.get('gatewayService')
				.getUserPermissions({
					guildId: createGuildID(BigInt(entry.guildId)),
					channelId: createChannelID(BigInt(entry.channelId)),
					userId: createUserID(BigInt(entry.userId)),
				});
			const required = BigInt(entry.requiredPermissions) | Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES;
			if ((permissions & required) !== required) throw new MissingPermissionsError();
			if (!(await cache.getAndDelete(key))) throw new AccessDeniedError();
			return ctx.json(
				await ctx
					.get('messageRequestService')
					.sendMessage({
						viewer: viewerFromCtx(ctx),
						user: ctx.get('user'),
						channelId: createChannelID(BigInt(entry.channelId)),
						requestCache: ctx.get('requestCache'),
						data: {...ctx.req.valid('json'), allowed_mentions: {parse: []}},
					}),
			);
		},
	);
}
