// SPDX-License-Identifier: AGPL-3.0-or-later
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import styles from '@app/features/voice/components/VoiceControlBar.module.css';
import {useLingui} from '@lingui/react/macro';
import {CubeIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {useRoom3dControls} from './Room3dControls';
export function Room3dControlButton() {
	const controls = useRoom3dControls();
	const {t} = useLingui();
	if (!controls?.enabled) return null;
	const label = controls.open ? t`Return to voice` : t`Enter 3D Room`;
	return (
		<Tooltip text={label}>
			<FocusRing offset={-2}>
				<button
					type="button"
					className={clsx(styles.button, controls.open ? styles.buttonScreenShareOn : styles.buttonScreenShareOff)}
					onClick={controls.open ? controls.close : controls.enter}
					aria-label={label}
					aria-pressed={controls.open}
					data-testid="enter-3d-room"
					data-flx="voice.voice-control-bar.room3d-button"
				>
					<CubeIcon weight="fill" className={styles.icon} />
				</button>
			</FocusRing>
		</Tooltip>
	);
}
