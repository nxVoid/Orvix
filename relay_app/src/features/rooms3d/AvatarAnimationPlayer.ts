// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	type AnimationAction,
	type AnimationClip,
	AnimationMixer,
	LoopRepeat,
	type Object3D,
} from 'three';

export type Locomotion = 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'dance';

export function localLocomotion(input: {
	x: number;
	z: number;
	run: boolean;
	sit?: boolean;
	emote?: 'wave' | 'dance';
}): Locomotion {
	if (input.sit) return 'sit';
	if (input.emote) return input.emote;
	if (Math.hypot(input.x, input.z) < 0.001) return 'idle';
	return input.run ? 'run' : 'walk';
}

export class AvatarAnimationPlayer {
	private readonly mixer: AnimationMixer;
	private action: AnimationAction | null = null;
	private readonly fadingActions = new Set<AnimationAction>();
	private mode: Locomotion | null = null;
	private fadeRemaining = 0;

	constructor(
		private readonly root: Object3D,
		private readonly clips: ReadonlyArray<AnimationClip>,
		private readonly names: Partial<Record<Locomotion, string>>,
	) {
		this.mixer = new AnimationMixer(root);
	}

	update(mode: Locomotion, seconds: number, reducedMotion: boolean) {
		const dt = Math.max(0, Math.min(0.1, seconds));

		if (this.mode !== mode) {
			const previousMode = this.mode;
			this.mode = mode;

			const clipName = this.names[mode] ?? this.names.idle;
			const clip = this.clips.find((c) => c.name === clipName);
			if (clip) {
				const previous = this.action;
				const next = this.mixer.clipAction(clip);

				next.setLoop(LoopRepeat, Infinity);

				// Transitions into or out of 'sit' use tight 0.08s crossfade to immediately anchor root to seat
				// General locomotion uses standard smooth 0.2s crossfading
				const isSittingTransition = mode === 'sit' || previousMode === 'sit';
				const fade = reducedMotion ? 0 : isSittingTransition ? 0.08 : 0.2;

				if (previous && previous !== next) {
					if (fade > 0) {
						previous.fadeOut(fade);
						this.fadingActions.add(previous);
						this.fadeRemaining = fade;
					} else {
						previous.stop();
					}
				}

				next.reset();
				next.setEffectiveTimeScale(1);
				next.setEffectiveWeight(1);
				if (fade > 0) {
					next.fadeIn(fade);
				}
				next.play();
				this.action = next;
			}
		}

		// Cleanly stop fading actions once transition duration elapses so actions don't accumulate
		if (this.fadingActions.size > 0) {
			this.fadeRemaining -= dt;
			if (this.fadeRemaining <= 0) {
				for (const fading of this.fadingActions) {
					fading.stop();
				}
				this.fadingActions.clear();
				this.fadeRemaining = 0;
			}
		}

		// Gait communicates movement. Reduced motion suppresses ambient idle or sitting motion, not walking/running.
		if (this.action) {
			this.action.paused = reducedMotion && (mode === 'idle' || mode === 'sit');
		}

		this.mixer.update(dt);
	}

	dispose() {
		this.mixer.stopAllAction();
		this.mixer.uncacheRoot(this.root);
		this.action = null;
		this.fadingActions.clear();
		this.mode = null;
	}
}
