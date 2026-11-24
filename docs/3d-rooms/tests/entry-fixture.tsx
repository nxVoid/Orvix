// SPDX-License-Identifier: AGPL-3.0-or-later
// Browser regression for the actual entry component; only transport, localization and heavy panel are stubbed.
import {createRoot} from 'react-dom/client';
import {Room3dControlButton} from '../../../relay_app/src/features/rooms3d/Room3dControlButton';
import {Room3dProvider} from '../../../relay_app/src/features/rooms3d/Room3dControls';
import {Room3dEntry} from '../../../relay_app/src/features/rooms3d/Room3dEntry';
import styles from '../../../relay_app/src/features/voice/components/VoiceControlBar.module.css';

declare global {
	interface Window {
		roomEntryHarness: {enabled: boolean; requests: number; entered: number; exited: number};
	}
}
window.roomEntryHarness = {enabled: false, requests: 0, entered: 0, exited: 0};
createRoot(document.getElementById('root')!).render(
	<Room3dProvider
		channelId="1"
		onEnter={() => {
			window.roomEntryHarness.entered++;
		}}
		onExit={() => {
			window.roomEntryHarness.exited++;
		}}
	>
		<div style={{position: 'relative', height: 320, background: '#20202a'}}>
			<Room3dEntry />
		</div>
		<footer className={styles.container}>
			<button type="button" className={styles.button} aria-label="Reference voice control">
				Mic
			</button>
			<Room3dControlButton />
		</footer>
	</Room3dProvider>,
);
