// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {http} from '@app/features/platform/transport/RestTransport';
import {StatusAwareAvatar} from '@app/features/ui/components/StatusAwareAvatar';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {openUserSettingsModal} from '@app/features/user/commands/UserSettingsModalCommands';
import Users from '@app/features/user/state/Users';
import {
	BellIcon,
	CoinsIcon,
	GiftIcon,
	QuestionIcon,
	UsersThreeIcon,
} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useState} from 'react';
import styles from './RelayTopHeader.module.css';

interface WalletResponse {
	balance: number;
}

const formatNumber = (num: number) => {
	return new Intl.NumberFormat('tr-TR').format(num);
};

export const RelayTopHeader: React.FC = observer(() => {
	const user = Users.currentUser;
	const [walletBalance, setWalletBalance] = useState<number | null>(null);

	useEffect(() => {
		let isMounted = true;
		const fetchWallet = async () => {
			try {
				const response = await http.get<WalletResponse>('/economy/wallet');
				if (isMounted && response?.body?.balance !== undefined) {
					setWalletBalance(response.body.balance);
				}
			} catch {
				if (isMounted && walletBalance === null) {
					setWalletBalance(50);
				}
			}
		};
		fetchWallet();
		return () => {
			isMounted = false;
		};
	}, []);

	const navigateTo = useCallback((path: string) => () => {
		RouterUtils.transitionTo(path);
	}, []);

	const displayedBalance = walletBalance !== null ? formatNumber(walletBalance) : '50';

	return (
		<header className={styles.header} data-flx="app.relay-top-header.header">
			<div className={styles.leftSection} data-flx="app.relay-top-header.left-section" />

			<div className={styles.centerTitle} data-flx="app.relay-top-header.center-title">
				Relay
			</div>

			<div className={styles.dragSpacer} data-flx="app.relay-top-header.drag-spacer" />

			<div className={styles.rightSection} data-flx="app.relay-top-header.right-section">
				<Tooltip position="bottom" text="Arkadaşlarını Relay'e Davet Et">
					<button
						type="button"
						className={styles.inviteButton}
						onClick={navigateTo(Routes.FRIENDS)}
						data-flx="app.relay-top-header.btn-invite-friend"
					>
						<GiftIcon size={16} weight="bold" />
						<span>Arkadaşını davet et</span>
					</button>
				</Tooltip>

				<Tooltip position="bottom" text="Relay Token Bakiyesi">
					<button
						type="button"
						className={styles.walletPill}
						onClick={navigateTo(Routes.STORE)}
						data-flx="app.relay-top-header.wallet-pill"
					>
						<span className={styles.walletIcon}>
							<CoinsIcon size={15} weight="fill" />
						</span>
						<span>{displayedBalance} RT</span>
					</button>
				</Tooltip>

				<Tooltip position="bottom" text="Bildirimler">
					<button
						type="button"
						className={styles.actionButton}
						onClick={navigateTo(Routes.NOTIFICATIONS)}
						aria-label="Bildirimler"
						data-flx="app.relay-top-header.action-button.notifications"
					>
						<BellIcon size={17} weight="regular" />
					</button>
				</Tooltip>

				<Tooltip position="bottom" text="Arkadaşlar">
					<button
						type="button"
						className={styles.actionButton}
						onClick={navigateTo(Routes.FRIENDS)}
						aria-label="Arkadaşlar"
						data-flx="app.relay-top-header.action-button.friends"
					>
						<UsersThreeIcon size={17} weight="regular" />
					</button>
				</Tooltip>

				<Tooltip position="bottom" text="Yardım ve Kılavuz">
					<button
						type="button"
						className={styles.actionButton}
						onClick={() => window.open('https://relay.app/help', '_blank', 'noreferrer')}
						aria-label="Yardım"
						data-flx="app.relay-top-header.action-button.help"
					>
						<QuestionIcon size={17} weight="regular" />
					</button>
				</Tooltip>

				{user && (
					<Tooltip position="bottom" text={`${user.globalName ?? user.username} - Ayarlar`}>
						<button
							type="button"
							className={styles.userShortcut}
							onClick={() => openUserSettingsModal()}
							aria-label="Kullanıcı Ayarları"
							data-flx="app.relay-top-header.user-shortcut"
						>
							<StatusAwareAvatar user={user} size={24} />
						</button>
					</Tooltip>
				)}
			</div>
		</header>
	);
});
