// SPDX-License-Identifier: AGPL-3.0-or-later

import {EconomyPanel, type Page} from '@app/features/economy/EconomyTab';
import {Scroller} from '@app/features/ui/components/Scroller';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import styles from './CosmeticsPage.module.css';

interface CosmeticsPageProps {
	defaultPage?: Page;
}

export const CosmeticsPage: React.FC<CosmeticsPageProps> = observer(({defaultPage = 'cosmetics'}) => {
	return (
		<div className={styles.pageContainer} data-flx="economy.cosmetics-page.page-container">
			<Scroller className={styles.scroller} data-flx="economy.cosmetics-page.scroller">
				<div className={styles.contentWrapper} data-flx="economy.cosmetics-page.content-wrapper">
					<EconomyPanel initialPage={defaultPage} />
				</div>
			</Scroller>
		</div>
	);
});
