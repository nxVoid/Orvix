// SPDX-License-Identifier: AGPL-3.0-or-later

import {SettingsTabContainer} from '@app/features/app/components/dialogs/shared/SettingsTabLayout';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {economyAssetUrl} from '@app/features/economy/CosmeticAssets';
import {invalidateOwnCosmetics} from '@app/features/economy/PublicCosmetics';
import {useStudioMotion} from '@app/features/economy/StudioMotion';
import {http} from '@app/features/platform/transport/RestTransport';
import Users from '@app/features/user/state/Users';
import {getUserAvatarURL} from '@app/features/user/utils/AvatarUtils';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';
import styles from './EconomyTab.module.css';

interface Item {
	id: string;
	name: string;
	description: string;
	category: string;
	rarity: string;
	price: number;
	asset: string;
	static_asset: string;
	premium: boolean;
	equipped?: boolean;
	stock: number | null;
	sold: number;
	starts_at: string | null;
	ends_at: string | null;
}
interface Mission {
	id: string;
	name: string;
	period: string;
	target: number;
	progress: number;
	reward: number;
	premium_bonus: number;
	premium: boolean;
	claimed: boolean;
	period_key: string;
	period_end: string;
	event: string;
}
interface Transaction {
	id: string;
	amount: number;
	balance_after: number;
	reason: string;
	created_at: string;
}
interface MissionClaim {
	mission_id: string;
	period_key: string;
	claimed_at: string;
	amount: number;
	name: string;
}
interface Wallet {
	balance: number;
	earned: string;
	spent: string;
}
export type Page = 'discover' | 'cosmetics' | 'store' | 'inventory' | 'missions' | 'history' | 'premium';

const pages: ReadonlyArray<[Page, string]> = [
	['discover', 'Keşfet'],
	['cosmetics', 'Kozmetik'],
	['store', 'Mağaza'],
	['inventory', 'Envanterim'],
	['missions', 'Görevler'],
	['history', 'İşlem geçmişi'],
	['premium', 'Premium'],
];
const labels: Record<string, string> = {
	avatar_frame: 'Avatar çerçevesi',
	banner: 'Banner',
	animated_banner: 'Animasyonlu banner',
	profile_theme: 'Profil teması',
	nameplate: 'İsim zemini',
	name_color: 'İsim rengi',
	profile_background: 'Profil arka planı',
	profile_effect: 'Profil efekti',
	badge: 'Rozet',
	premium_collection: 'Premium koleksiyon',
};
const errors: Record<string, string> = {
	INSUFFICIENT_POINTS: 'Bu ürün için yeterli RP yok.',
	PREMIUM_REQUIRED: 'Bu özellik için Relay Premium gerekiyor.',
	ALREADY_OWNED: 'Bu ürün zaten envanterinde.',
	OUT_OF_STOCK: 'Ürünün stoğu tükendi.',
	PRICE_CHANGED: 'Ürün fiyatı değişti. Mağazayı yenileyip tekrar dene.',
	NOT_FOR_SALE: 'Ürün şu anda satışta değil.',
	MISSION_INCOMPLETE: 'Bu görev henüz tamamlanmadı veya süresi doldu.',
	ALREADY_CLAIMED: 'Bu ödülü zaten aldın.',
	DAILY_REWARD_LIMIT: 'Bugünkü görev ödülü sınırına ulaştın.',
	ECONOMY_UNAVAILABLE: 'Bu sunucuda Relay Points kullanılamıyor.',
};
const rp = new Intl.NumberFormat('tr-TR');
const periodLabels: Record<string, string> = {daily: 'Günlük', weekly: 'Haftalık', event: 'Etkinlik'};

function equipLabel(item: Item, premium: boolean): string {
	if (item.equipped) return 'Çıkar';
	if (item.premium && !premium) return 'Premium gerekli';
	return 'Kuşan';
}

function missionLabel(mission: Mission, premium: boolean): string {
	if (mission.claimed) return 'Ödül alındı';
	if (mission.premium && !premium) return 'Premium gerekli';
	if (mission.progress < mission.target) return 'Devam ediyor';
	return 'Ödülü al';
}

function Artwork({item, preview = false}: {item: Item; preview?: boolean}) {
	const user = Users.currentUser;
	const motion = useStudioMotion(preview);
	const staticUrl = economyAssetUrl(item.static_asset);
	return (
		<div ref={motion.ref} className={styles.artwork} data-category={item.category}>
			{preview && user && item.category === 'avatar_frame' && (
				<img className={styles.previewAvatar} alt="" src={getUserAvatarURL(user, false)} />
			)}
			<picture>
				<source media="(prefers-reduced-motion: reduce)" srcSet={staticUrl} />
				<img alt="" loading="lazy" decoding="async" src={motion.playing ? economyAssetUrl(item.asset) : staticUrl} />
			</picture>
		</div>
	);
}

function MotionImage({item, className}: {item: Item; className?: string}) {
	const motion = useStudioMotion(true);
	const [failed, setFailed] = useState(false);
	return (
		<picture ref={motion.ref} className={className}>
			<source media="(prefers-reduced-motion: reduce)" srcSet={economyAssetUrl(item.static_asset)} />
			<img
				alt=""
				decoding="async"
				loading="lazy"
				src={economyAssetUrl(motion.playing && !failed ? item.asset : item.static_asset)}
				onError={() => setFailed(true)}
			/>
		</picture>
	);
}

function ProfilePreview({candidate, equipped}: {candidate: Item; equipped: ReadonlyArray<Item>}) {
	const user = Users.currentUser;
	if (!user) return null;
	const selected = (categories: ReadonlyArray<string>) =>
		categories.includes(candidate.category)
			? candidate
			: equipped.find((item) => categories.includes(item.category) && item.equipped);
	const frame = selected(['avatar_frame']);
	const banner = selected(['banner', 'animated_banner']);
	const nameplate = selected(['nameplate']);
	return (
		<section className={styles.profilePreview} aria-label="Profil üzerinde canlı önizleme">
			<div className={styles.previewBanner}>{banner && <MotionImage key={banner.id} item={banner} />}</div>
			<div className={styles.previewIdentity}>
				<div className={styles.previewPortrait}>
					<img alt="" src={getUserAvatarURL(user, false)} />
					{frame && <MotionImage key={frame.id} item={frame} className={styles.previewFrame} />}
				</div>
				<strong
					style={
						nameplate
							? {backgroundImage: `url(${economyAssetUrl(nameplate.static_asset)})`, backgroundSize: '100% 100%'}
							: undefined
					}
				>
					{user.globalName ?? user.username}
				</strong>
				<span>Relay</span>
			</div>
		</section>
	);
}

function explainError(error: unknown) {
	const response = error as {body?: {code?: string}; response?: {body?: {code?: string}}};
	const code = response?.body?.code ?? response?.response?.body?.code;
	return (code && errors[code]) || 'İşlem tamamlanamadı. Tekrar deneyebilirsin.';
}

const EconomyTab = observer(function EconomyTab() {
	const account = Users.currentUser?.id;
	return account ? <EconomyPanel key={`${RuntimeConfig.transportApiEndpoint}:${account}`} /> : null;
});

export function EconomyPanel({initialPage = 'discover'}: {initialPage?: Page} = {}) {
	const [page, setPage] = useState<Page>(initialPage);

	useEffect(() => {
		if (initialPage) {
			setPage(initialPage);
		}
	}, [initialPage]);
	const [rarity, setRarity] = useState('');
	const [sort, setSort] = useState('featured');
	const [category, setCategory] = useState('');
	const [wallet, setWallet] = useState<Wallet>();
	const [items, setItems] = useState<Array<Item>>([]);
	const [owned, setOwned] = useState<Array<Item>>([]);
	const [missions, setMissions] = useState<Array<Mission>>([]);
	const [history, setHistory] = useState<Array<Transaction>>([]);
	const [claimHistory, setClaimHistory] = useState<Array<MissionClaim>>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [premium, setPremium] = useState(false);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState('');
	const [preview, setPreview] = useState<Item>();
	const [confirm, setConfirm] = useState(false);
	const dialog = useRef<HTMLDialogElement>(null);
	const busyRef = useRef(false);
	const operationKeys = useRef(new Map<string, string>());

	const refresh = useCallback(async (signal?: AbortSignal) => {
		const [account, catalog, inventory] = await Promise.all([
			http.get<Wallet>('/economy/wallet', {signal}),
			http.get<{items: Array<Item>; premium: boolean}>('/economy/catalog', {signal}),
			http.get<{items: Array<Item>}>('/economy/inventory', {signal}),
		]);
		if (signal?.aborted) return;
		setWallet(account.body);
		setItems(catalog.body.items);
		setPremium(catalog.body.premium);
		setOwned(inventory.body.items);
	}, []);

	const refreshMissions = useCallback(async (signal?: AbortSignal) => {
		const result = await http.get<{missions: Array<Mission>}>('/economy/missions', {signal});
		if (!signal?.aborted) setMissions(result.body.missions);
	}, []);

	const loadHistory = useCallback(async (before?: string, signal?: AbortSignal) => {
		const result = await http.get<{transactions: Array<Transaction>; next: string | null}>('/economy/history', {
			query: {before},
			signal,
		});
		if (signal?.aborted) return;
		setHistory((previous) => (before ? [...previous, ...result.body.transactions] : result.body.transactions));
		setCursor(result.body.next);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refresh(controller.signal).catch((error) => {
			if (!controller.signal.aborted) setFeedback(explainError(error));
		});
		return () => controller.abort();
	}, [refresh]);

	useEffect(() => {
		const controller = new AbortController();
		const report = (error: unknown) => {
			if (!controller.signal.aborted) setFeedback(explainError(error));
		};
		let timer: number | undefined;
		let debounce: number | undefined;
		const update = () => {
			window.clearTimeout(debounce);
			debounce = window.setTimeout(() => {
				if (busyRef.current || document.hidden) return;
				void refresh(controller.signal).catch(report);
				if (page === 'missions') void refreshMissions(controller.signal).catch(report);
			}, 250);
		};
		window.addEventListener('relay-economy-update', update);
		if (page === 'missions') {
			void refreshMissions(controller.signal).catch(report);
			void http
				.get<{claims: Array<MissionClaim>}>('/economy/mission-history', {signal: controller.signal})
				.then((result) => {
					if (!controller.signal.aborted) setClaimHistory(result.body.claims);
				})
				.catch(report);
			timer = window.setInterval(() => {
				if (!document.hidden) void refreshMissions(controller.signal).catch(report);
			}, 10_000);
		}
		if (page === 'history') void loadHistory(undefined, controller.signal).catch(report);
		return () => {
			controller.abort();
			window.clearInterval(timer);
			window.clearTimeout(debounce);
			window.removeEventListener('relay-economy-update', update);
		};
	}, [page, refresh, refreshMissions, loadHistory]);

	useEffect(() => {
		if (preview && dialog.current && !dialog.current.open) dialog.current.showModal();
	}, [preview]);

	async function perform(action: () => Promise<unknown>, message: string) {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		setFeedback('');
		try {
			await action();
			setFeedback(message);
			await refresh();
			if (page === 'missions') {
				await refreshMissions();
				const result = await http.get<{claims: Array<MissionClaim>}>('/economy/mission-history');
				setClaimHistory(result.body.claims);
			}
		} catch (error) {
			setFeedback(explainError(error));
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	}

	function keyFor(operation: string) {
		const key =
			operationKeys.current.get(operation) ??
			Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
				byte.toString(16).padStart(2, '0'),
			).join('');
		operationKeys.current.set(operation, key);
		return key;
	}

	function purchase(item: Item) {
		void perform(async () => {
			const operation = `buy:${item.id}:${item.price}`;
			await http.post('/economy/purchase', {
				body: {cosmetic_id: item.id, expected_price: item.price, key: keyFor(operation)},
			});
			operationKeys.current.delete(operation);
			dialog.current?.close();
		}, 'Kozmetik envanterine eklendi.');
	}

	function equip(item: Item) {
		void perform(
			async () => {
				await http.put('/economy/equipped', {
					body: {category: item.category, cosmetic_id: item.equipped ? null : item.id},
				});
				invalidateOwnCosmetics();
			},
			item.equipped ? 'Kozmetik çıkarıldı.' : 'Kozmetik kuşanıldı.',
		);
	}

	function claim(mission: Mission) {
		void perform(async () => {
			const operation = `claim:${mission.id}:${mission.period_key}`;
			await http.post('/economy/claim', {
				body: {
					mission_id: mission.id,
					period_key: mission.period_key,
					key: keyFor(operation),
				},
			});
			operationKeys.current.delete(operation);
		}, 'Görev ödülü cüzdanına eklendi.');
	}

	function purchaseLabel(item: Item) {
		if (owned.some((entry) => entry.id === item.id)) return 'Sende var';
		if (item.premium && !premium) return 'Premium gerekli';
		if (item.stock != null && item.sold >= item.stock) return 'Stok tükendi';
		if (
			(item.starts_at && Date.parse(item.starts_at) > Date.now()) ||
			(item.ends_at && Date.parse(item.ends_at) <= Date.now())
		)
			return 'Satışta değil';
		if (!wallet || item.price > wallet.balance) return 'Yetersiz RP';
		return 'Satın al';
	}

	const visible = (page === 'inventory' ? owned : items)
		.filter((item) => (!category || category === item.category) && (!rarity || rarity === item.rarity))
		.sort((a, b) => {
			if (sort === 'price-up') return a.price - b.price;
			if (sort === 'price-down') return b.price - a.price;
			const first = ['quantum_horizon', 'violet_halo', 'amethyst_crown', 'midnight_orbit'];
			const rank = (id: string) => (first.includes(id) ? first.indexOf(id) : first.length);
			return rank(a.id) - rank(b.id) || a.price - b.price;
		});
	const catalogPage = ['store', 'inventory', 'cosmetics', 'discover'].includes(page);
	const featured = items.find((item) => item.id === 'quantum_horizon');

	return (
		<SettingsTabContainer>
			<section className={styles.panel} aria-label="Relay Points">
				<header className={styles.hero}>
					<div>
						<h2>Kendine ait bir profil.</h2>
						<p>Relay Cosmetics Studio</p>
					</div>
					<div className={styles.balance}>
						<strong>{wallet ? rp.format(wallet.balance) : '…'} RP</strong>
						{wallet && (
							<small>
								{rp.format(BigInt(wallet.earned))} kazanılan · {rp.format(BigInt(wallet.spent))} harcanan
							</small>
						)}
					</div>
				</header>
				<nav className={styles.navigation} aria-label="Relay Points bölümleri">
					{pages.map(([id, title]) => (
						<button
							key={id}
							type="button"
							aria-pressed={page === id}
							onClick={() => {
								setPage(id);
								setFeedback('');
							}}
						>
							{title}
						</button>
					))}
				</nav>
				{feedback && (
					<p className={styles.feedback} role="status">
						{feedback}
					</p>
				)}
				{!wallet && feedback && (
					<button type="button" onClick={() => void refresh().catch((error) => setFeedback(explainError(error)))}>
						Tekrar dene
					</button>
				)}
				{page === 'discover' && featured && (
					<button
						type="button"
						className={styles.featured}
						onClick={() => {
							setPreview(featured);
							setConfirm(false);
						}}
					>
						<img alt="" src={economyAssetUrl(featured.static_asset)} />
						<span>
							<strong>Quantum Horizon</strong>
							<span>Origins koleksiyonu</span>
						</span>
					</button>
				)}
				{catalogPage && (
					<>
						<div className={styles.filters}>
							<label className={styles.filter}>
								<span>Kategori</span>
								<select value={category} onChange={(event) => setCategory(event.target.value)}>
									<option value="">Tümü</option>
									{Object.entries(labels).map(([id, name]) => (
										<option key={id} value={id}>
											{name}
										</option>
									))}
								</select>
							</label>
							<label className={styles.filter}>
								<span>Nadirlik</span>
								<select value={rarity} onChange={(event) => setRarity(event.target.value)}>
									<option value="">Tümü</option>
									{['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'].map((value) => (
										<option key={value}>{value}</option>
									))}
								</select>
							</label>
							<label className={styles.filter}>
								<span>Sıralama</span>
								<select value={sort} onChange={(event) => setSort(event.target.value)}>
									<option value="featured">Öne çıkanlar</option>
									<option value="price-up">Fiyat artan</option>
									<option value="price-down">Fiyat azalan</option>
								</select>
							</label>
						</div>
						{visible.length === 0 && wallet && <p>Bu kategoride ürün yok.</p>}
						<div className={styles.grid}>
							{visible.map((item) => (
								<article key={item.id} className={styles.card}>
									<button
										type="button"
										className={styles.previewButton}
										onClick={() => {
											setPreview(item);
											setConfirm(false);
										}}
										aria-label={`${item.name} önizleme`}
									>
										<Artwork item={item} />
									</button>
									<small>
										{item.rarity} · {labels[item.category]}
										{item.premium ? ' · Premium' : ''}
									</small>
									<h3>{item.name}</h3>
									{page !== 'inventory' ? (
										<div className={styles.actions}>
											<strong>{rp.format(item.price)} RP</strong>
											<button
												type="button"
												disabled={purchaseLabel(item) !== 'Satın al' || busy}
												onClick={() => {
													setPreview(item);
													setConfirm(true);
												}}
											>
												{purchaseLabel(item)}
											</button>
										</div>
									) : (
										<div className={styles.actions}>
											{item.equipped && <span>Kuşanıldı</span>}
											<button
												type="button"
												disabled={busy || Boolean(item.premium && !premium && !item.equipped)}
												onClick={() => equip(item)}
											>
												{equipLabel(item, premium)}
											</button>
										</div>
									)}
								</article>
							))}
						</div>
					</>
				)}
				{page === 'missions' && (
					<>
						<p>Günlük görevler UTC gece yarısında, haftalık görevler pazartesi günü yenilenir.</p>
						{missions.map((mission) => {
							const minutes = mission.event === 'voice';
							return (
								<article key={mission.id} className={styles.row}>
									<div>
										<strong>{mission.name}</strong>
										<p>
											{`${periodLabels[mission.period] ?? 'Görev'} · ${mission.reward + (premium ? mission.premium_bonus : 0)} RP`}
										</p>
									</div>
									<div>
										<progress
											value={Math.min(mission.progress, mission.target)}
											max={mission.target}
											aria-label={mission.name}
										/>
										<p>
											{minutes
												? `${Math.floor(mission.progress / 60)} / ${mission.target / 60} dk`
												: `${Math.min(mission.progress, mission.target)} / ${mission.target}`}
										</p>
									</div>
									<button
										type="button"
										disabled={
											busy || mission.claimed || mission.progress < mission.target || (mission.premium && !premium)
										}
										onClick={() => claim(mission)}
									>
										{missionLabel(mission, premium)}
									</button>
								</article>
							);
						})}
						{claimHistory.length > 0 && (
							<details>
								<summary>Alınan ödüller</summary>
								{claimHistory.map((entry) => (
									<div key={`${entry.mission_id}:${entry.period_key}`} className={styles.row}>
										<span>{entry.name}</span>
										<time dateTime={entry.claimed_at}>{new Date(entry.claimed_at).toLocaleDateString('tr-TR')}</time>
										<strong>+{entry.amount} RP</strong>
									</div>
								))}
							</details>
						)}
					</>
				)}
				{page === 'history' && (
					<>
						{history.length === 0 && <p>Henüz işlem yok.</p>}
						{history.map((entry) => (
							<article key={entry.id} className={styles.row}>
								<div>
									<strong>{entry.reason}</strong>
									<p>{new Date(entry.created_at).toLocaleString('tr-TR')}</p>
								</div>
								<span>
									{entry.amount > 0 ? '+' : ''}
									{rp.format(entry.amount)} RP
								</span>
								<small>Bakiye {rp.format(entry.balance_after)} RP</small>
							</article>
						))}
						{cursor && (
							<button
								type="button"
								onClick={() => void loadHistory(cursor).catch((error) => setFeedback(explainError(error)))}
							>
								Daha eski işlemler
							</button>
						)}
					</>
				)}
				{page === 'premium' && (
					<article className={styles.card}>
						<h3>Relay Premium</h3>
						<p>
							{premium ? 'Premium avantajların aktif.' : 'Premium avantajlarını abonelik ayarlarından yönetebilirsin.'}
						</p>
						<ul>
							<li>Özel avatar çerçeveleri ve banner’lar</li>
							<li>Premium koleksiyonlar</li>
							<li>Uygun görevlerde ek RP</li>
						</ul>
						<button
							type="button"
							onClick={() => {
								setCategory('');
								setPage('store');
							}}
						>
							Koleksiyonu keşfet
						</button>
					</article>
				)}
				<dialog
					ref={dialog}
					className={styles.dialog}
					onClose={() => {
						setPreview(undefined);
						setConfirm(false);
					}}
					aria-label="Kozmetik önizleme"
				>
					{preview && (
						<>
							<ProfilePreview candidate={preview} equipped={owned} />
							<h3>{preview.name}</h3>
							<p>{preview.description}</p>
							{confirm && <p>Cüzdanından {rp.format(preview.price)} RP harcanacak.</p>}
							{feedback && <p role="status">{feedback}</p>}
							<div className={styles.actions}>
								<button type="button" onClick={() => dialog.current?.close()}>
									Kapat
								</button>
								{page !== 'inventory' && (
									<button
										type="button"
										disabled={busy || purchaseLabel(preview) !== 'Satın al'}
										onClick={() => (confirm ? purchase(preview) : setConfirm(true))}
									>
										{confirm ? 'Satın almayı onayla' : purchaseLabel(preview)}
									</button>
								)}
							</div>
						</>
					)}
				</dialog>
			</section>
		</SettingsTabContainer>
	);
}

export default EconomyTab;
