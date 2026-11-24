// SPDX-License-Identifier: AGPL-3.0-or-later
import {Trans, useLingui} from '@lingui/react/macro';
import type {RoomTemplateId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {useState} from 'react';
import styles from './RoomPanel.module.css';

export interface RoomTemplateCardDef {
	id: RoomTemplateId;
	name: string;
	tagline: string;
	description: string;
	features: Array<string>;
	gradient: string;
	icon: string;
	ambientColor: string;
}

export const ROOM_TEMPLATES: Record<RoomTemplateId, RoomTemplateCardDef> = {
	gaming: {
		id: 'gaming',
		name: 'Gaming Lounge',
		tagline: 'Esports, chill vibes & casual streaming',
		description:
			'Modern social lounge with dual-monitor gaming battle-stations, plush velvet sofas, warm wood slats, and a 16:9 media wall.',
		features: ['Dual-monitor gaming desks', 'Plush lounge sofas', 'Wall-mounted 16:9 TV', 'Floor lamps & greenery'],
		gradient: 'linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #1e1b4b 100%)',
		icon: '🎮',
		ambientColor: '#818cf8',
	},
	meeting: {
		id: 'meeting',
		name: 'Executive Meeting Room',
		tagline: 'Professional presentations & team standups',
		description:
			'Sleek executive conference boardroom featuring a massive conference table, 16 ergonomic office chairs, and an executive presentation display.',
		features: ['16 Conference chairs', 'Center presentation display', 'Recessed overhead lighting', 'Architectural plants'],
		gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
		icon: '💼',
		ambientColor: '#38bdf8',
	},
	cinema: {
		id: 'cinema',
		name: 'Cinema Room',
		tagline: 'Watch parties, streams & movie nights',
		description:
			'Tiered theater auditorium with stepped acoustic carpet risers, 18 luxury lounge theater seats with a wide center aisle, and a giant 16:9 projection screen.',
		features: ['Giant 16:9 projection screen', '3 Tiered seating rows', '2.4m Center aisle', 'Warm acoustic sconces'],
		gradient: 'linear-gradient(135deg, #450a0a 0%, #581c87 50%, #180828 100%)',
		icon: '🎬',
		ambientColor: '#f43f5e',
	},
	rooftop: {
		id: 'rooftop',
		name: 'Social Rooftop Terrace',
		tagline: 'Twilight skyline, open-air bar & firepit',
		description:
			'Open-air high-rise rooftop patio with a glowing fire pit, perimeter glass safety railings, outdoor lounge seating, bar counter, and 3D city skyline backdrop.',
		features: ['3D City skyline backdrop', 'Glowing central fire pit', 'Rooftop bar with stools', 'Terrace pergola screen'],
		gradient: 'linear-gradient(135deg, #7c2d12 0%, #831843 50%, #1e1b4b 100%)',
		icon: '🌆',
		ambientColor: '#f97316',
	},
};

export function RoomBrowserModal({
	currentTemplateId,
	participantCount = 0,
	maxParticipants = 16,
	canManage = false,
	busy = false,
	onSelectAndEnter,
	onClose,
}: {
	currentTemplateId: RoomTemplateId;
	participantCount?: number;
	maxParticipants?: number;
	canManage?: boolean;
	busy?: boolean;
	onSelectAndEnter: (templateId: RoomTemplateId) => void;
	onClose: () => void;
}) {
	const {t} = useLingui();
	const [selected, setSelected] = useState<RoomTemplateId>(currentTemplateId);

	const templateList = Object.values(ROOM_TEMPLATES);

	return (
		<div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="room-browser-title">
			<div className={styles.roomBrowserContent}>
				{/* Modal Header */}
				<div className={styles.modalHeader}>
					<div style={{display: 'flex', alignItems: 'center', gap: 12}}>
						<span style={{fontSize: 24}}>🌐</span>
						<div>
							<h2 id="room-browser-title">
								<Trans>Orvix 3D Room Browser</Trans>
							</h2>
							<p style={{margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary, #9e9ab0)'}}>
								<Trans>Choose an environment to explore with your voice channel.</Trans>
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className={styles.modalCloseButton}
						aria-label={t`Close room browser`}
					>
						✕
					</button>
				</div>

				{/* Room Cards Grid */}
				<div className={styles.roomGrid}>
					{templateList.map((tpl) => {
						const isSelected = tpl.id === selected;
						const isCurrent = tpl.id === currentTemplateId;
						return (
							/* biome-ignore lint/a11y/noStaticElementInteractions: Clickable room selection card */
							<div
								key={tpl.id}
								className={`${styles.roomCard} ${isSelected ? styles.roomCardActive : ''}`}
								onClick={() => setSelected(tpl.id)}
								style={{'--card-glow': tpl.ambientColor} as React.CSSProperties}
							>
								{/* Visual Room Banner */}
								<div className={styles.roomCardBanner} style={{background: tpl.gradient}}>
									<span className={styles.roomCardIcon}>{tpl.icon}</span>
									{isCurrent && (
										<span className={styles.roomActivePill}>
											<Trans>Active Room</Trans>
										</span>
									)}
									<span className={styles.roomCapacityBadge}>
										{participantCount}/{maxParticipants} <Trans>players</Trans>
									</span>
								</div>

								{/* Card Details */}
								<div className={styles.roomCardBody}>
									<h3 className={styles.roomCardTitle}>{tpl.name}</h3>
									<p className={styles.roomCardTagline}>{tpl.tagline}</p>
									<p className={styles.roomCardDesc}>{tpl.description}</p>

									<ul className={styles.roomFeatureList}>
										{tpl.features.map((f) => (
											<li key={f}>
												<span style={{color: '#9061f9'}}>✦</span> {f}
											</li>
										))}
									</ul>
								</div>
							</div>
						);
					})}
				</div>

				{/* Modal Footer / Action Bar */}
				<div className={styles.roomBrowserFooter}>
					<div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa6bd'}}>
						<span>
							<Trans>Room Capacity</Trans>: <strong style={{color: '#f2f0f7'}}>{maxParticipants} players</strong>
						</span>
						<span>·</span>
						<span>
							<Trans>Live Voice</Trans>: <strong style={{color: '#10b981'}}>Connected</strong>
						</span>
						{canManage && (
							<>
								<span>·</span>
								<span style={{color: '#a855f7', fontWeight: 600}}>
									<Trans>Host Controls Active</Trans>
								</span>
							</>
						)}
					</div>

					<div style={{display: 'flex', gap: 12}}>
						<button type="button" onClick={onClose} className={styles.secondaryButton}>
							<Trans>Cancel</Trans>
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => onSelectAndEnter(selected)}
							className={styles.primaryActionButton}
						>
							<span>
								<Trans>Enter {ROOM_TEMPLATES[selected].name}</Trans>
							</span>
							<span style={{fontSize: 16}}>➔</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
