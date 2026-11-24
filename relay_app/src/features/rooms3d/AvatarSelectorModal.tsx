// SPDX-License-Identifier: AGPL-3.0-or-later
import {Trans, useLingui} from '@lingui/react/macro';
import {AVATAR_IDS, type AvatarId} from '@relay/schema/src/domains/rooms3d/RoomSchemas';
import {useEffect, useState} from 'react';
import {type AvatarCategory, AVATAR_PRESETS} from './AvatarCatalog';
import styles from './RoomPanel.module.css';

const CATEGORIES: Array<AvatarCategory | 'All'> = [
	'All',
	'Masculine',
	'Feminine',
	'Fantasy / Sci-Fi',
	'Animals / Robots',
];

export function AvatarSelectorModal({
	currentAvatarId,
	busy,
	onSelect,
	onClose,
}: {
	currentAvatarId: AvatarId;
	busy: boolean;
	onSelect: (avatarId: AvatarId) => void;
	onClose: () => void;
}) {
	const {t} = useLingui();
	const [selectedCategory, setSelectedCategory] = useState<AvatarCategory | 'All'>('All');

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

	const filteredAvatars = AVATAR_IDS.filter((id) => {
		if (selectedCategory === 'All') return true;
		return AVATAR_PRESETS[id]?.category === selectedCategory;
	});

	return (
		<div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={t`Choose Avatar`}>
			<div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h2>
						<Trans>Select 3D Avatar</Trans>
					</h2>
					<button type="button" onClick={onClose} aria-label={t`Close`}>
						✕
					</button>
				</div>

				<div className={styles.categoryTabs} role="tablist">
					{CATEGORIES.map((cat) => (
						<button
							key={cat}
							type="button"
							role="tab"
							aria-selected={selectedCategory === cat}
							className={`${styles.categoryTab} ${selectedCategory === cat ? styles.categoryTabActive : ''}`}
							onClick={() => setSelectedCategory(cat)}
						>
							{cat}
						</button>
					))}
				</div>

				<div className={styles.avatarGrid}>
					{filteredAvatars.map((id) => {
						const preset = AVATAR_PRESETS[id];
						const isActive = currentAvatarId === id;
						return (
							<button
								key={id}
								type="button"
								disabled={busy}
								className={`${styles.avatarCard} ${isActive ? styles.avatarCardActive : ''}`}
								onClick={() => {
									onSelect(id);
									onClose();
								}}
							>
								<div className={styles.avatarCardHeader}>
									<span className={styles.avatarCardName}>{preset.name}</span>
									<span className={styles.avatarBadge}>{preset.category}</span>
								</div>
								<div className={styles.avatarDesc}>{preset.description}</div>
								{isActive && (
									<div className={styles.activeTag}>
										<span>✓</span>
										<Trans>Equipped</Trans>
									</div>
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
