// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {StudioMotionBudget} from '../../../../relay_app/src/features/economy/StudioMotionBudget';

describe('studio playback budget', () => {
	it('bounds concurrent playback and promotes the next visible request', () => {
		const budget = new StudioMotionBudget(2);
		const states = [false, false, false];
		const releases = states.map((_, index) =>
			budget.request((value) => {
				states[index] = value;
			}),
		);
		expect(states).toEqual([true, true, false]);
		releases[0]();
		expect(states[2]).toBe(true);
		releases[1]();
		releases[2]();
	});

	it('does not resume a request that became hidden while waiting', () => {
		const budget = new StudioMotionBudget(1);
		const releaseFirst = budget.request(() => {});
		let second = false;
		const cancelSecond = budget.request((value) => {
			second = value;
		});
		cancelSecond();
		releaseFirst();
		expect(second).toBe(false);
	});
});
