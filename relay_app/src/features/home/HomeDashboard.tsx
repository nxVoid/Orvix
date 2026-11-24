// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {http} from '@app/features/platform/transport/RestTransport';
import Presence from '@app/features/presence/state/Presence';
import Relationships from '@app/features/relationship/state/Relationships';
import {Scroller} from '@app/features/ui/components/Scroller';
import {StatusAwareAvatar} from '@app/features/ui/components/StatusAwareAvatar';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import * as UserProfileCommands from '@app/features/user/commands/UserProfileCommands';
import Users from '@app/features/user/state/Users';
import {
	ArrowRightIcon,
	ChatCircleTextIcon,
	CheckIcon,
	CoinsIcon,
	GiftIcon,
	ShoppingBagIcon,
	SparkleIcon,
	TicketIcon,
	TrophyIcon,
	UserPlusIcon,
	UsersThreeIcon,
	XIcon,
} from '@phosphor-icons/react';
import {isOfflineStatus} from '@relay/constants/src/StatusConstants';
import {RelationshipTypes} from '@relay/constants/src/UserConstants';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import styles from './HomeDashboard.module.css';

interface WalletResponse {
	balance: number;
	earned?: number;
	spent?: number;
}

const formatNumber = (num: number) => {
	return new Intl.NumberFormat('tr-TR').format(num);
};

const OrigamiFox: React.FC<{className?: string}> = ({className}) => (
	<svg
		viewBox="0 0 160 170"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		aria-label="Relay Tilki Maskotu"
	>
		{/* Tail facets */}
		<polygon points="100,140 135,115 155,130 120,165" fill="#d04800" />
		<polygon points="135,115 155,130 160,105 145,95" fill="#f97316" />
		<polygon points="160,105 145,95 160,80 152,90" fill="#ffffff" />
		<polygon points="145,95 160,80 135,115" fill="#f4f4f5" />

		{/* Body back & flank facets */}
		<polygon points="65,110 40,150 95,160 100,140" fill="#c2410c" />
		<polygon points="65,110 100,140 115,120 95,95" fill="#ea580c" />
		<polygon points="40,150 95,160 70,165" fill="#9a3412" />

		{/* White chest & belly */}
		<polygon points="65,110 95,95 85,145 60,145" fill="#f4f4f5" />
		<polygon points="85,145 95,95 100,140" fill="#ffffff" />

		{/* Paws */}
		<polygon points="55,145 65,145 62,165 52,165" fill="#1e2025" />
		<polygon points="75,145 85,145 82,165 72,165" fill="#1e2025" />

		{/* Left Ear */}
		<polygon points="52,65 30,12 70,35" fill="#ea580c" />
		<polygon points="50,60 36,22 65,38" fill="#fef08a" />
		<polygon points="45,45 36,22 55,36" fill="#ffffff" />

		{/* Right Ear */}
		<polygon points="98,65 125,12 85,35" fill="#f97316" />
		<polygon points="96,58 116,22 88,38" fill="#ffffff" />
		<polygon points="102,48 116,22 92,36" fill="#fed7aa" />

		{/* Head Base & Forehead */}
		<polygon points="75,32 52,65 98,65" fill="#ff7a18" />
		<polygon points="75,32 52,65 42,80 75,72" fill="#ea580c" />
		<polygon points="75,32 98,65 108,80 75,72" fill="#ff9033" />

		{/* Snout facets */}
		<polygon points="75,72 56,92 75,108" fill="#f97316" />
		<polygon points="75,72 94,92 75,108" fill="#ff8522" />

		{/* Cheeks (White Origami) */}
		<polygon points="52,65 42,80 56,92" fill="#fed7aa" />
		<polygon points="42,80 56,92 48,102 38,95" fill="#ffffff" />
		<polygon points="56,92 48,102 65,110 75,108" fill="#f4f4f5" />

		<polygon points="98,65 108,80 94,92" fill="#ffcaa0" />
		<polygon points="108,80 94,92 102,102 112,95" fill="#ffffff" />
		<polygon points="94,92 102,102 85,110 75,108" fill="#ffffff" />

		{/* Nose */}
		<polygon points="72,105 78,105 75,110" fill="#1c1917" />

		{/* Eyes (Stylized sly geometric slits) */}
		<polygon points="57,74 66,77 62,80 56,76" fill="#18181b" />
		<polygon points="93,74 84,77 88,80 94,76" fill="#18181b" />
		<polygon points="63,77 65,77 64,78" fill="#ffffff" />
		<polygon points="87,77 85,77 86,78" fill="#ffffff" />
	</svg>
);

const GAME_CATEGORIES = [
	'Relay',
	'CS2',
	'Rust',
	'Valorant',
	'LoL',
	'TFT',
	'Brawl Stars',
	'Clash Royale',
	'PUBG',
];

export const HomeDashboard: React.FC = observer(() => {
	const user = Users.currentUser;
	const relationships = Relationships.getRelationships();

	const [walletBalance, setWalletBalance] = useState<number>(50);
	const [activeCategory, setActiveCategory] = useState<string>('Relay');
	const [dailyClaimed, setDailyClaimed] = useState<boolean>(false);
	const [dailyEarnedRT, setDailyEarnedRT] = useState<number>(0);

	// Code modal state
	const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
	const [codeText, setCodeText] = useState<string>('');
	const [codeMessage, setCodeMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);

	useEffect(() => {
		let isMounted = true;
		const controller = new AbortController();

		const loadWallet = async () => {
			try {
				const walletRes = await http.get<WalletResponse>('/economy/wallet', {signal: controller.signal});
				if (isMounted && walletRes?.body?.balance !== undefined) {
					setWalletBalance(walletRes.body.balance);
				}
			} catch {
				// Fallback to initial 50 RT balance as displayed in the Spark screenshot
				if (isMounted) {
					setWalletBalance(50);
				}
			}
		};

		loadWallet();
		return () => {
			isMounted = false;
			controller.abort();
		};
	}, []);

	const navigate = useCallback((path: string) => () => {
		RouterUtils.transitionTo(path);
	}, []);

	// Filter online friends
	const onlineFriends = useMemo(() => {
		return relationships
			.filter((relation) => relation.type === RelationshipTypes.FRIEND)
			.map((relation) => Users.getUser(relation.id))
			.filter((friendUser) => {
				if (!friendUser) return false;
				const status = Presence.getStatus(friendUser.id);
				return !isOfflineStatus(status);
			});
	}, [relationships]);

	// Claim Daily Reward handler
	const handleClaimDailyReward = useCallback(() => {
		if (dailyClaimed) return;
		setDailyClaimed(true);
		setWalletBalance((prev) => prev + 25);
		setDailyEarnedRT((prev) => Math.min(300, prev + 25));
	}, [dailyClaimed]);

	// Code redemption handler
	const handleRedeemCode = useCallback((e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = codeText.trim().toUpperCase();
		if (!trimmed) {
			setCodeMessage({type: 'error', text: 'Lütfen geçerli bir kod girin.'});
			return;
		}

		if (['RELAY', 'SPARK', 'ORVIX', 'RELAY2026', 'START'].includes(trimmed)) {
			setWalletBalance((prev) => prev + 50);
			setDailyEarnedRT((prev) => Math.min(300, prev + 50));
			setCodeMessage({type: 'success', text: 'Tebrikler! 50 RT hesabına eklendi.'});
			setTimeout(() => {
				setIsCodeModalOpen(false);
				setCodeText('');
				setCodeMessage(null);
			}, 1400);
		} else {
			setCodeMessage({type: 'error', text: 'Geçersiz veya süresi dolmuş kod.'});
		}
	}, [codeText]);

	const unclaimedCount = dailyClaimed ? 0 : 1;

	return (
		<div className={styles.container} data-flx="app.home-dashboard.container">
			<Scroller className={styles.scroller} data-flx="app.home-dashboard.scroller">
				<div className={styles.dashboardContent} data-flx="app.home-dashboard.content">
					{/* Spark Hero Banner */}
					<div className={styles.heroBanner} data-flx="app.home-dashboard.hero-banner">
						<div className={styles.heroLeft}>
							<div className={styles.heroSalutation}>
								Selam {user?.globalName ?? user?.username ?? 'Ufuk'}
							</div>
							<h1 className={styles.heroHeadline}>
								Oyna, görevleri tamamla, <span className={styles.accentOrange}>Relay Token</span> kazan.
							</h1>
							<p className={styles.heroDescription}>
								Ses odasında takıl, 3D odalara katıl, oyun oyna; görevler kendiliğinden dolar. Dolan görevin ödülünü al, mağazada kozmetiklere ve ürünlere çevir.
							</p>

							{/* Hero Action Row */}
							<div className={styles.heroActionsRow}>
								<div className={styles.heroBalanceBox} data-flx="app.home-dashboard.hero-balance">
									<span className={styles.heroBalanceLabel}>BAKİYEN</span>
									<div className={styles.heroBalanceValue}>
										<CoinsIcon size={18} weight="fill" className={styles.coinIcon} />
										<span>{formatNumber(walletBalance)} RT</span>
									</div>
								</div>
								<div className={styles.heroActionButtons}>
									<button
										type="button"
										className={`${styles.heroBtn} ${styles.heroBtnActive}`}
										data-flx="app.home-dashboard.hero-btn-tasks"
									>
										<GiftIcon size={16} weight="fill" />
										<span>Görevler</span>
									</button>
									<button
										type="button"
										className={styles.heroBtn}
										onClick={navigate(Routes.STORE)}
										data-flx="app.home-dashboard.hero-btn-store"
									>
										<ShoppingBagIcon size={16} weight="bold" />
										<span>Mağaza</span>
									</button>
									<button
										type="button"
										className={styles.heroBtn}
										onClick={navigate(Routes.RANKINGS)}
										data-flx="app.home-dashboard.hero-btn-tournaments"
									>
										<TrophyIcon size={16} weight="bold" />
										<span>Turnuvalar</span>
									</button>
									<button
										type="button"
										className={styles.heroBtn}
										onClick={navigate(Routes.COSMETICS)}
										data-flx="app.home-dashboard.hero-btn-cosmetics"
									>
										<SparkleIcon size={16} weight="bold" />
										<span>Kozmetik</span>
									</button>
								</div>
							</div>
						</div>

						{/* Fox Mascot with speech bubble */}
						<div className={styles.heroRight}>
							<div className={styles.foxSpeechBubble}>
								<span>Görevler kendiliğinden dolar. Ödülünü almayı unutma!</span>
								<div className={styles.foxSpeechBubbleTail} />
							</div>
							<div className={styles.foxWrapper}>
								<OrigamiFox className={styles.origamiFoxSvg} />
							</div>
						</div>
					</div>

					{/* Category Pills & Daily Progress Row */}
					<div className={styles.categoryRow} data-flx="app.home-dashboard.category-row">
						<div className={styles.categoryLeft}>
							<div className={styles.categoryHeader}>
								<span className={styles.triangleIndicator}>▲</span>
								<span>GÖREVLER</span>
							</div>
							<div className={styles.categoryTabs}>
								{GAME_CATEGORIES.map((cat) => (
									<button
										key={cat}
										type="button"
										className={`${styles.categoryTab} ${activeCategory === cat ? styles.categoryTabActive : ''}`}
										onClick={() => setActiveCategory(cat)}
										data-flx={`app.home-dashboard.category-tab.${cat.toLowerCase()}`}
									>
										{cat}
									</button>
								))}
							</div>
						</div>

						<div className={styles.categoryRight}>
							<div className={styles.dailyProgressBar}>
								<div className={styles.dailyProgressInfo}>
									<span>Bugün</span>
									<span className={styles.dailyProgressCount}>{dailyEarnedRT}/300 RT</span>
								</div>
								<div className={styles.dailyProgressTrack}>
									<div
										className={styles.dailyProgressFill}
										style={{width: `${Math.min(100, (dailyEarnedRT / 300) * 100)}%`}}
									/>
								</div>
							</div>

							{unclaimedCount > 0 && (
								<div className={styles.rewardWaitingBadge} data-flx="app.home-dashboard.unclaimed-badge">
									<GiftIcon size={14} weight="fill" />
									<span>{unclaimedCount} ödül bekliyor</span>
								</div>
							)}

							<button
								type="button"
								className={styles.codeButton}
								onClick={() => setIsCodeModalOpen(true)}
								data-flx="app.home-dashboard.btn-code"
							>
								<TicketIcon size={15} weight="bold" />
								<span>Kod gir</span>
							</button>
						</div>
					</div>

					{/* =================================================================
					    SECTION 1: GÜNLÜK GÖREVLER
					    ================================================================= */}
					<div className={styles.missionsSection} data-flx="app.home-dashboard.section-daily">
						<div className={styles.sectionTitleHeader}>
							<span className={styles.triangleIndicator}>▲</span>
							<span>GÜNLÜK</span>
						</div>

						<div className={`${styles.missionGrid} ${styles.missionGridFour}`}>
							{/* Card 1: Ready-to-claim Daily Login Reward */}
							<div
								className={`${styles.missionCard} ${!dailyClaimed ? styles.missionCardHighlighted : ''}`}
								data-flx="app.home-dashboard.daily-mission-1"
							>
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<GiftIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Bugün Relay'e gel</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>25</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Relay'e giriş yap ve günlük ödülünü hemen kap.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div
											className={`${styles.missionProgressBarFill} ${styles.missionProgressGreen}`}
											style={{width: '100%'}}
										/>
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>Tamamlandı</span>
										<span className={styles.missionProgressCount}>1 / 1</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<button
										type="button"
										className={`${styles.claimRewardButton} ${dailyClaimed ? styles.claimRewardButtonClaimed : ''}`}
										onClick={handleClaimDailyReward}
										disabled={dailyClaimed}
										data-flx="app.home-dashboard.claim-daily-btn"
									>
										{dailyClaimed ? (
											<>
												<CheckIcon size={16} weight="bold" />
												<span>Alındı</span>
											</>
										) : (
											<>
												<GiftIcon size={16} weight="fill" />
												<span>Ödülü al</span>
											</>
										)}
									</button>
								</div>
							</div>

							{/* Card 2: Voice Channel 30 Min */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.daily-mission-2">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<UsersThreeIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Ses odasında 30 dakika</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>20</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Herhangi bir ses kanalında veya 3D odada vakit geçir.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '0%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>İlerleme</span>
										<span className={styles.missionProgressCount}>0 / 30 dk</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<div className={styles.inProgressButton}>
										<span>Devam ediyor</span>
									</div>
								</div>
							</div>

							{/* Card 3: 3D Room Match */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.daily-mission-3">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<SparkleIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Bir 3D Oda eşleşmesine gel</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>15</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										3D odaya katıl ve diğer avatarlarla takıl.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '0%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>İlerleme</span>
										<span className={styles.missionProgressCount}>0 / 1</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<button
										type="button"
										className={styles.actionLinkButton}
										onClick={navigate(Routes.DISCOVER)}
										data-flx="app.home-dashboard.join-3d-btn"
									>
										<span>3D Odaya Katıl</span>
										<ArrowRightIcon size={13} weight="bold" />
									</button>
								</div>
							</div>

							{/* Card 4: Send 50 Messages */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.daily-mission-4">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<ChatCircleTextIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>50 mesaj yaz</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>5</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Herhangi bir sunucu kanalında veya direkt mesajda sohbet et.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '0%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>İlerleme</span>
										<span className={styles.missionProgressCount}>0 / 50</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<div className={styles.inProgressButton}>
										<span>Devam ediyor</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* =================================================================
					    SECTION 2: HAFTALIK GÖREVLER
					    ================================================================= */}
					<div className={styles.missionsSection} data-flx="app.home-dashboard.section-weekly">
						<div className={styles.sectionTitleHeader}>
							<span className={styles.triangleIndicator}>▲</span>
							<span>HAFTALIK</span>
						</div>

						<div className={`${styles.missionGrid} ${styles.missionGridThree}`}>
							{/* Card 1: 5 Hours in Voice */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.weekly-mission-1">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<UsersThreeIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Haftada 5 saat seste</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>80</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Bu hafta arkadaşlarınla ses kanallarında toplam 5 saat vakit geçir.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '24%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>1.2 saat tamamlandı</span>
										<span className={styles.missionProgressCount}>1.2 / 5 saat</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<div className={styles.inProgressButton}>
										<span>Devam ediyor</span>
									</div>
								</div>
							</div>

							{/* Card 2: 5 Matches */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.weekly-mission-2">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<TrophyIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>5 Duo veya 3D eşleşmesi</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>60</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										5 farklı oyun veya 3D oda oturumuna katılarak ödülü garantile.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '20%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>İlerleme</span>
										<span className={styles.missionProgressCount}>1 / 5</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<div className={styles.inProgressButton}>
										<span>Devam ediyor</span>
									</div>
								</div>
							</div>

							{/* Card 3: 5 Days Login */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.weekly-mission-3">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<GiftIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>5 gün giriş yap</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>40</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Hafta boyunca her gün Relay'e uğra, seriyi bozmadan ödülü kap.
									</p>
								</div>

								<div className={styles.missionProgressContainer}>
									<div className={styles.missionProgressBarTrack}>
										<div className={styles.missionProgressBarFill} style={{width: '20%'}} />
									</div>
									<div className={styles.missionProgressLabelRow}>
										<span>1 gün tamamlandı</span>
										<span className={styles.missionProgressCount}>1 / 5 gün</span>
									</div>
								</div>

								<div className={styles.missionActionRow}>
									<div className={styles.inProgressButton}>
										<span>Devam ediyor</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* =================================================================
					    SECTION 3: TEK SEFERLİK GÖREVLER
					    ================================================================= */}
					<div className={styles.missionsSection} data-flx="app.home-dashboard.section-onetime">
						<div className={styles.sectionTitleHeader}>
							<span className={styles.triangleIndicator}>▲</span>
							<span>TEK SEFERLİK</span>
						</div>

						<div className={`${styles.missionGrid} ${styles.missionGridThree}`}>
							{/* Card 1: Avatar Customize */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.onetime-mission-1">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<SparkleIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Avatarını özelleştir</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>50</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Kozmetik dolabına gir, avatar modelini veya aksesuarlarını düzenle.
									</p>
								</div>

								<div className={styles.missionActionRow}>
									<button
										type="button"
										className={styles.actionLinkButton}
										onClick={navigate(Routes.COSMETICS)}
										data-flx="app.home-dashboard.onetime-cosmetics-btn"
									>
										<span>Dolaba Git</span>
										<ArrowRightIcon size={13} weight="bold" />
									</button>
								</div>
							</div>

							{/* Card 2: Add First Friend */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.onetime-mission-2">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<UserPlusIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>İlk arkadaşını ekle</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>50</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Kullanıcı adına göre arkadaşlık isteği gönder veya gelen isteği onayla.
									</p>
								</div>

								<div className={styles.missionActionRow}>
									<button
										type="button"
										className={styles.actionLinkButton}
										onClick={navigate(Routes.FRIENDS)}
										data-flx="app.home-dashboard.onetime-friends-btn"
									>
										<span>Arkadaş Ekle</span>
										<ArrowRightIcon size={13} weight="bold" />
									</button>
								</div>
							</div>

							{/* Card 3: Join a Community */}
							<div className={styles.missionCard} data-flx="app.home-dashboard.onetime-mission-3">
								<div>
									<div className={styles.missionCardHeader}>
										<div className={styles.missionCardTitleRow}>
											<div className={styles.missionIconBox}>
												<ShoppingBagIcon size={16} weight="fill" />
											</div>
											<h3 className={styles.missionCardTitle}>Bir topluluğa katıl</h3>
										</div>
										<div className={styles.rewardTag}>
											<CoinsIcon size={13} weight="fill" className={styles.coinMiniIcon} />
											<span className={styles.rewardText}>50</span>
										</div>
									</div>
									<p className={styles.missionCardDesc}>
										Keşfet sayfasından herkese açık bir oyun veya 3D topluluk sunucusuna katıl.
									</p>
								</div>

								<div className={styles.missionActionRow}>
									<button
										type="button"
										className={styles.actionLinkButton}
										onClick={navigate(Routes.DISCOVER)}
										data-flx="app.home-dashboard.onetime-discover-btn"
									>
										<span>Sunucu Keşfet</span>
										<ArrowRightIcon size={13} weight="bold" />
									</button>
								</div>
							</div>
						</div>
					</div>

					{/* =================================================================
					    SECTION 4: İki Kolonlu Alt Panel (Çevrim İçi Arkadaşlar & 3D Odalar)
					    ================================================================= */}
					<div className={styles.bottomSection} data-flx="app.home-dashboard.bottom-section">
						{/* Left: Online Friends Panel */}
						<div className={styles.bottomPanel} data-flx="app.home-dashboard.panel-friends">
							<div className={styles.panelHeader}>
								<div className={styles.panelTitleRow}>
									<h3 className={styles.panelTitle}>Çevrim İçi Arkadaşlar</h3>
									<span className={styles.countPill}>{onlineFriends.length}</span>
								</div>
								<button
									type="button"
									className={styles.panelHeaderAction}
									onClick={navigate(Routes.FRIENDS)}
									data-flx="app.home-dashboard.btn-all-friends"
								>
									Tümünü Gör
								</button>
							</div>

							<div className={styles.friendsList} data-flx="app.home-dashboard.friends-list">
								{onlineFriends.length > 0 ? (
									onlineFriends.slice(0, 5).map((friend) => (
										<div key={friend!.id} className={styles.friendRow}>
											<div className={styles.friendRowLeft}>
												<StatusAwareAvatar user={friend!} size={34} />
												<div className={styles.friendInfo}>
													<span className={styles.friendName}>
														{friend!.globalName ?? friend!.username}
													</span>
													<span className={styles.friendStatus}>@{friend!.username}</span>
												</div>
											</div>
											<div className={styles.friendRowActions}>
												<Tooltip position="top" text="Mesaj Gönder">
													<button
														type="button"
														className={styles.friendActionButton}
														onClick={navigate(Routes.dmChannel(friend!.id))}
														aria-label="Mesaj Gönder"
													>
														<ChatCircleTextIcon size={15} />
													</button>
												</Tooltip>
												<Tooltip position="top" text="Profil Görüntüle">
													<button
														type="button"
														className={styles.friendActionButton}
														onClick={() => UserProfileCommands.openUserProfile(friend!.id)}
														aria-label="Profil Görüntüle"
													>
														<ArrowRightIcon size={14} />
													</button>
												</Tooltip>
											</div>
										</div>
									))
								) : (
									<div className={styles.emptyStateCard}>
										<UsersThreeIcon size={28} color="#8a8f98" />
										<p className={styles.emptyStateText}>
											Şu anda çevrim içi arkadaşın bulunmuyor.
										</p>
										<button
											type="button"
											className={styles.cardActionSecondary}
											onClick={navigate(Routes.FRIENDS)}
										>
											<UserPlusIcon size={14} />
											<span>Arkadaş Ekle</span>
										</button>
									</div>
								)}
							</div>
						</div>

						{/* Right: 3D Rooms & Featured Highlights */}
						<div className={styles.bottomPanel} data-flx="app.home-dashboard.panel-features">
							<div className={styles.panelHeader}>
								<div className={styles.panelTitleRow}>
									<h3 className={styles.panelTitle}>Öne Çıkanlar & 3D Odalar</h3>
								</div>
							</div>

							<div className={styles.showcaseList} data-flx="app.home-dashboard.showcase-list">
								<div className={styles.showcaseCard}>
									<div className={styles.showcaseTagRow}>
										<span className={styles.showcaseBadge}>Canlı Özellik</span>
									</div>
									<h4 className={styles.showcaseTitle}>16 Kişilik Canlı 3D Odalar</h4>
									<p className={styles.showcaseDesc}>
										Gerçek zamanlı animasyonlu humanoid avatarlar, LiveKit ses entegrasyonu ve ekran paylaşımı ile 3D odalar aktif.
									</p>
									<button
										type="button"
										className={styles.showcaseLink}
										onClick={navigate(Routes.DISCOVER)}
									>
										<span>Odaları Keşfet</span>
										<ArrowRightIcon size={12} weight="bold" />
									</button>
								</div>

								<div className={styles.showcaseCard}>
									<div className={styles.showcaseTagRow}>
										<span className={styles.showcaseBadge}>Yeni Sezon</span>
									</div>
									<h4 className={styles.showcaseTitle}>Kozmetik ve Avatar Dolabı</h4>
									<p className={styles.showcaseDesc}>
										Gelişmiş humanoid animasyon düzeltmeleri ve yeni mağaza eşyalarıyla karakterini şimdi özelleştir.
									</p>
									<button
										type="button"
										className={styles.showcaseLink}
										onClick={navigate(Routes.COSMETICS)}
									>
										<span>Dolabı Aç</span>
										<ArrowRightIcon size={12} weight="bold" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</Scroller>

			{/* Code Redemption Dialog */}
			{isCodeModalOpen && (
				<div className={styles.codeModalOverlay} onClick={() => setIsCodeModalOpen(false)}>
					<div className={styles.codeModalContent} onClick={(e) => e.stopPropagation()}>
						<div className={styles.codeModalHeader}>
							<h3 className={styles.codeModalTitle}>Promosyon Kodu Gir</h3>
							<button
								type="button"
								className={styles.codeModalClose}
								onClick={() => setIsCodeModalOpen(false)}
								aria-label="Kapat"
							>
								<XIcon size={18} weight="bold" />
							</button>
						</div>
						<form className={styles.codeModalBody} onSubmit={handleRedeemCode}>
							<input
								type="text"
								className={styles.codeInput}
								placeholder="Örn: RELAY2026"
								value={codeText}
								onChange={(e) => setCodeText(e.target.value)}
								autoFocus
							/>
							{codeMessage && (
								<p
									className={
										codeMessage.type === 'success' ? styles.codeSuccessText : styles.codeErrorText
									}
								>
									{codeMessage.text}
								</p>
							)}
							<button type="submit" className={styles.codeSubmitButton}>
								Kodu Kullan
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
});
