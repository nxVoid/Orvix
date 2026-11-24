// SPDX-License-Identifier: AGPL-3.0-or-later
import {Trans} from '@lingui/react/macro';
import {Component, lazy, type ReactNode, Suspense} from 'react';

import {useRoom3dControls} from './Room3dControls';

const RoomPanel = lazy(() => import('./RoomPanel'));
class EntryBoundary extends Component<{children: ReactNode; onExit: () => void}, {failed: boolean}> {
	override state = {failed: false};
	static getDerivedStateFromError() {
		return {failed: true};
	}
	override render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div role="alert" style={{position: 'absolute', inset: 0, zIndex: 5, padding: 24, background: '#13131c'}}>
				<p>
					<Trans>The 3D view could not load. Voice remains available.</Trans>
				</p>
				<button type="button" onClick={this.props.onExit}>
					<Trans>Return to voice</Trans>
				</button>
			</div>
		);
	}
}
export function Room3dEntry() {
	const controls = useRoom3dControls();
	if (!controls?.enabled || !controls.open) return null;
	const {channelId, close} = controls;
	return (
		<EntryBoundary onExit={close}>
			<Suspense
				fallback={
					<div role="status" style={{position: 'absolute', inset: 0, zIndex: 5, background: '#13131c', padding: 24}}>
						<Trans>Loading 3D assets…</Trans>
						<button type="button" onClick={close}>
							<Trans>Return to voice</Trans>
						</button>
					</div>
				}
			>
				<RoomPanel key={channelId} channelId={channelId} onExit={close} />
			</Suspense>
		</EntryBoundary>
	);
}
