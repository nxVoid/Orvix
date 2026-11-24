// SPDX-License-Identifier: AGPL-3.0-or-later

import {useCallback, useEffect, useState} from 'react';
import {StudioMotionBudget} from './StudioMotionBudget';

const budget = new StudioMotionBudget(2);
type SaveDataNavigator = Navigator & {connection?: {saveData?: boolean}};

export function useStudioMotion(requested: boolean) {
	const [element, setElement] = useState<Element | null>(null);
	const [eligible, setEligible] = useState(false);
	const [granted, setGranted] = useState(false);
	const ref = useCallback((node: Element | null) => setElement(node), []);

	useEffect(() => {
		if (!requested || !element) {
			setEligible(false);
			return;
		}
		let visible = false;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const lowPower = window.matchMedia('(pointer: coarse)');
		const update = () =>
			setEligible(
				visible &&
					!document.hidden &&
					!reduced.matches &&
					!lowPower.matches &&
					!(navigator as SaveDataNavigator).connection?.saveData,
			);
		if (typeof IntersectionObserver === 'undefined') {
			setEligible(false);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				visible = entries.some((entry) => entry.isIntersecting);
				update();
			},
			{threshold: 0.05},
		);
		observer.observe(element);
		document.addEventListener('visibilitychange', update);
		reduced.addEventListener('change', update);
		lowPower.addEventListener('change', update);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', update);
			reduced.removeEventListener('change', update);
			lowPower.removeEventListener('change', update);
		};
	}, [element, requested]);

	useEffect(() => {
		setGranted(false);
		if (!requested || !eligible) return;
		return budget.request(setGranted);
	}, [requested, eligible]);

	return {ref, playing: requested && eligible && granted};
}
