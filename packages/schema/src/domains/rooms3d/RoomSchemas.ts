// SPDX-License-Identifier: AGPL-3.0-or-later
import {z} from 'zod';

export const ROOM_CAPACITY = 16;
export const AVATAR_IDS = [
	'violet',
	'lunar',
	'ember',
	'mint',
	'alex',
	'kai',
	'marcus',
	'jax',
	'orion',
	'leo',
	'hunter',
	'sam',
	'elena',
	'nova',
	'astra',
	'morgan',
	'raven',
	'valkyrie',
] as const;
export const TEMPLATE_IDS = ['gaming', 'meeting', 'cinema', 'rooftop'] as const;
export const AvatarIdSchema = z.enum(AVATAR_IDS);
export const RoomTemplateSchema = z.enum(TEMPLATE_IDS);
export const RoomConfigSchema = z
	.object({
		version: z.literal(1).default(1),
		enabled: z.boolean(),
		templateId: RoomTemplateSchema,
		maxParticipants: z.number().int().min(1).max(ROOM_CAPACITY),
		spatialAudioEnabled: z.boolean(),
	})
	.strict();
export type RoomConfig = z.infer<typeof RoomConfigSchema>;
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
	version: 1,
	enabled: true,
	templateId: 'gaming',
	maxParticipants: 16,
	spatialAudioEnabled: true,
};
export const RoomJoinSchema = z.object({connectionId: z.string().min(1).max(128)}).strict();
export const MovementSchema = z
	.object({
		connectionId: z.string().min(1).max(128),
		sessionId: z.uuid(),
		sequence: z.number().int().min(0).max(1_000_000_000),
		x: z.number().finite().min(-1).max(1),
		z: z.number().finite().min(-1).max(1),
		rotationY: z.number().finite().min(-Math.PI).max(Math.PI),
		run: z.boolean(),
		sit: z.boolean().optional(),
		emote: z.enum(['wave', 'dance']).optional(),
	})
	.strict();
export type MovementInput = z.infer<typeof MovementSchema>;
export type AvatarId = z.infer<typeof AvatarIdSchema>;
export type RoomTemplateId = z.infer<typeof RoomTemplateSchema>;
export interface AvatarState {
	userId: string;
	connectionId: string;
	avatarId: AvatarId;
	position: {x: number; y: number; z: number};
	rotationY: number;
	animation: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'dance';
	sequence: number;
}
export interface RoomSnapshot {
	generation: string;
	revision: number;
	config: RoomConfig;
	participants: Array<AvatarState>;
	serverTime: number;
}
export const RoomSnapshotSchema = z
	.object({
		config: RoomConfigSchema,
		generation: z.uuid(),
		revision: z.number().int().nonnegative(),
		serverTime: z.number().finite(),
		participants: z
			.array(
				z
					.object({
						userId: z.string().regex(/^[0-9]{1,20}$/u),
						connectionId: z.string().min(1).max(128),
						avatarId: AvatarIdSchema,
						position: z
							.object({x: z.number().finite().min(-10).max(10), y: z.literal(0), z: z.number().finite().min(-8).max(8)})
							.strict(),
						rotationY: z.number().finite(),
						animation: z.enum(['idle', 'walk', 'run', 'sit', 'wave', 'dance']),
						sequence: z.number().int().nonnegative(),
					})
					.strict(),
			)
			.max(ROOM_CAPACITY),
	})
	.strict();
