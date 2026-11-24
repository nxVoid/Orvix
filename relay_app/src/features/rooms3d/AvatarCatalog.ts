// SPDX-License-Identifier: AGPL-3.0-or-later
import type {AvatarId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';

export type AvatarModelId =
	| 'robot'
	| 'fox'
	| 'human_casual'
	| 'human_casual2'
	| 'human_suit'
	| 'human_punk'
	| 'human_spacesuit'
	| 'human_swat'
	| 'human_adventurer'
	| 'woman_casual'
	| 'woman_formal'
	| 'woman_punk'
	| 'woman_scifi'
	| 'woman_witch'
	| 'woman_soldier'
	| 'knight';

export type AvatarCategory = 'Masculine' | 'Feminine' | 'Fantasy / Sci-Fi' | 'Animals / Robots';

export interface AvatarModelDef {
	url: string;
	height: number;
	eyeHeight?: number;
	nameplateHeight?: number;
	clips: {
		idle: string;
		walk: string;
		run: string;
		sit: string;
		wave?: string;
		dance?: string;
	};
}

const HUMAN_CLIPS = {
	idle: 'Idle',
	walk: 'Walk',
	run: 'Run',
	sit: 'Sit',
	wave: 'Wave',
	dance: 'Dance',
} as const;

export const AVATAR_MODELS: Record<AvatarModelId, AvatarModelDef> = {
	robot: {
		url: new URL('./assets/robot-expressive.glb', import.meta.url).href,
		height: 1.95,
		clips: {idle: 'Idle', walk: 'Walking', run: 'Running', sit: 'Sitting', wave: 'Wave', dance: 'Dance'},
	},
	fox: {
		url: new URL('./assets/fox.glb', import.meta.url).href,
		height: 1.1,
		clips: {idle: 'Survey', walk: 'Walk', run: 'Run', sit: 'Survey', wave: 'Survey', dance: 'Run'},
	},
	human_casual: {
		url: new URL('./assets/human-casual.glb', import.meta.url).href,
		height: 1.8,
		clips: HUMAN_CLIPS,
	},
	human_casual2: {
		url: new URL('./assets/human-casual2.glb', import.meta.url).href,
		height: 1.8,
		clips: HUMAN_CLIPS,
	},
	human_suit: {
		url: new URL('./assets/human-suit.glb', import.meta.url).href,
		height: 1.82,
		clips: HUMAN_CLIPS,
	},
	human_punk: {
		url: new URL('./assets/human-punk.glb', import.meta.url).href,
		height: 1.82,
		clips: HUMAN_CLIPS,
	},
	human_spacesuit: {
		url: new URL('./assets/human-spacesuit.glb', import.meta.url).href,
		height: 1.85,
		clips: HUMAN_CLIPS,
	},
	human_swat: {
		url: new URL('./assets/human-swat.glb', import.meta.url).href,
		height: 1.82,
		clips: HUMAN_CLIPS,
	},
	human_adventurer: {
		url: new URL('./assets/human-adventurer.glb', import.meta.url).href,
		height: 1.85,
		clips: HUMAN_CLIPS,
	},
	woman_casual: {
		url: new URL('./assets/woman-casual.glb', import.meta.url).href,
		height: 1.72,
		clips: HUMAN_CLIPS,
	},
	woman_formal: {
		url: new URL('./assets/woman-formal.glb', import.meta.url).href,
		height: 1.74,
		clips: HUMAN_CLIPS,
	},
	woman_punk: {
		url: new URL('./assets/woman-punk.glb', import.meta.url).href,
		height: 1.74,
		clips: HUMAN_CLIPS,
	},
	woman_scifi: {
		url: new URL('./assets/woman-scifi.glb', import.meta.url).href,
		height: 1.75,
		clips: HUMAN_CLIPS,
	},
	woman_witch: {
		url: new URL('./assets/woman-witch.glb', import.meta.url).href,
		height: 1.85,
		clips: HUMAN_CLIPS,
	},
	woman_soldier: {
		url: new URL('./assets/woman-soldier.glb', import.meta.url).href,
		height: 1.75,
		clips: HUMAN_CLIPS,
	},
	knight: {
		url: new URL('./assets/knight.glb', import.meta.url).href,
		height: 1.9,
		clips: HUMAN_CLIPS,
	},
};

export interface AvatarPreset {
	name: string;
	model: AvatarModelId;
	category: AvatarCategory;
	description: string;
	tint?: string;
}

export const AVATAR_PRESETS: Record<AvatarId, AvatarPreset> = {
	// Preserved original IDs
	violet: {
		name: 'Violet Robot',
		model: 'robot',
		category: 'Animals / Robots',
		description: 'Expressive android companion in violet chassis',
		tint: '#9061f9',
	},
	lunar: {
		name: 'Lunar Robot',
		model: 'robot',
		category: 'Animals / Robots',
		description: 'Tactical android in polished lunar chrome',
		tint: '#c9d4ed',
	},
	ember: {
		name: 'Fox',
		model: 'fox',
		category: 'Animals / Robots',
		description: 'Agile woodland fox with smooth running gaits',
		tint: '#ffffff',
	},
	mint: {
		name: 'Moon Fox',
		model: 'fox',
		category: 'Animals / Robots',
		description: 'Rare celestial fox with moonlit mint fur',
		tint: '#aed9df',
	},
	// Masculine human characters
	alex: {
		name: 'Alex',
		model: 'human_casual',
		category: 'Masculine',
		description: 'Casual guy in comfortable t-shirt and denim',
	},
	kai: {
		name: 'Kai',
		model: 'human_casual2',
		category: 'Masculine',
		description: 'Streetwear hoodie with urban high-tops',
	},
	marcus: {
		name: 'Marcus',
		model: 'human_suit',
		category: 'Masculine',
		description: 'Sharp formal business suit with classic tie',
	},
	jax: {
		name: 'Jax',
		model: 'human_punk',
		category: 'Masculine',
		description: 'Rebellious rocker with mohawk and leather jacket',
	},
	leo: {
		name: 'Leo',
		model: 'human_swat',
		category: 'Masculine',
		description: 'Tactical SWAT operative with protective vest',
	},
	hunter: {
		name: 'Hunter',
		model: 'human_adventurer',
		category: 'Masculine',
		description: 'Wilderness explorer with gear pack and slouch hat',
	},
	// Feminine human characters
	sam: {
		name: 'Sam',
		model: 'woman_casual',
		category: 'Feminine',
		description: 'Casual girl in relaxed everyday comfort outfit',
	},
	elena: {
		name: 'Elena',
		model: 'woman_formal',
		category: 'Feminine',
		description: 'Elegant formal dress suited for executive gatherings',
	},
	nova: {
		name: 'Nova',
		model: 'woman_punk',
		category: 'Feminine',
		description: 'Cyberpunk musician with dyed hair and biker vest',
	},
	raven: {
		name: 'Raven',
		model: 'woman_soldier',
		category: 'Feminine',
		description: 'Disciplined combat specialist in combat fatigues',
	},
	// Fantasy / Sci-Fi
	orion: {
		name: 'Orion',
		model: 'human_spacesuit',
		category: 'Fantasy / Sci-Fi',
		description: 'Deep-space astronaut in pressurized EVA suit',
	},
	astra: {
		name: 'Astra',
		model: 'woman_scifi',
		category: 'Fantasy / Sci-Fi',
		description: 'Futuristic interstellar navigator in cybernetic weave',
	},
	morgan: {
		name: 'Morgan',
		model: 'woman_witch',
		category: 'Fantasy / Sci-Fi',
		description: 'Enchanting mystic wearing ceremonial robes and hat',
	},
	valkyrie: {
		name: 'Valkyrie',
		model: 'knight',
		category: 'Fantasy / Sci-Fi',
		description: 'Armored medieval knight with gleaming plate cuirass',
	},
};
