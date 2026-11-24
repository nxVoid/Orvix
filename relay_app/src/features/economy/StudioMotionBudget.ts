// SPDX-License-Identifier: AGPL-3.0-or-later

/** FIFO admission bounds simultaneous cosmetic decoders across the app. */
export class StudioMotionBudget {
	private readonly waiting = new Map<symbol, (granted: boolean) => void>();
	private readonly playing = new Set<symbol>();

	constructor(private readonly capacity = 2) {}

	request(listener: (granted: boolean) => void): () => void {
		const key = Symbol('cosmetic-animation');
		this.waiting.set(key, listener);
		listener(false);
		this.admit();
		return () => {
			this.waiting.delete(key);
			this.playing.delete(key);
			this.admit();
		};
	}

	private admit() {
		for (const [key, listener] of this.waiting) {
			if (this.playing.size >= this.capacity) break;
			if (this.playing.has(key)) continue;
			this.playing.add(key);
			listener(true);
		}
	}
}
