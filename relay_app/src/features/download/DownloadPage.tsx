// SPDX-License-Identifier: AGPL-3.0-or-later

import RelayMark from '@app/media/images/relay-logo-color.svg?react';
import {
	AppleLogoIcon,
	ArrowDownIcon,
	ArrowRightIcon,
	ArrowUpRightIcon,
	ChatCircleDotsIcon,
	CheckIcon,
	LinuxLogoIcon,
	VideoCameraIcon,
	WaveformIcon,
	WindowsLogoIcon,
} from '@phosphor-icons/react';
import {useCallback, useEffect, useState} from 'react';
import {
	ARCHES,
	type DesktopArch,
	type DesktopPlatform,
	type DesktopRelease,
	type DownloadCatalog,
	type DownloadFile,
	detectArch,
	detectPlatform,
	FORMAT_LABELS,
	FORMATS,
	formatSize,
	loadDownloadCatalog,
	PLATFORM_NAMES,
	PLATFORMS,
	type ReleaseChannel,
} from './DownloadMetadata';
import styles from './DownloadPage.module.css';

const platformIcons = {win32: WindowsLogoIcon, darwin: AppleLogoIcon, linux: LinuxLogoIcon};
const PLATFORM_DESCRIPTIONS = {
	win32: 'Your everyday space, right on your taskbar.',
	darwin: 'Right at home, from your first hello.',
	linux: 'Your desktop. On your terms.',
};
function archLabel(platform: DesktopPlatform, arch: DesktopArch): string {
	if (platform === 'darwin') return arch === 'arm64' ? 'Apple Silicon' : 'Intel';
	return arch === 'arm64' ? 'ARM64' : 'Intel / AMD · 64-bit';
}
function ArtifactLink({
	file,
	label,
	primary = false,
	unavailableLabel = 'Not available',
}: {
	file?: DownloadFile;
	label: string;
	primary?: boolean;
	unavailableLabel?: string;
}) {
	return file ? (
		<a
			className={primary ? styles.primaryButton : styles.fileLink}
			href={file.url}
			rel="noopener noreferrer"
			aria-label={`${label}${formatSize(file.size) ? `, ${formatSize(file.size)}` : ''}`}
		>
			<span>{label}</span>
			{primary ? (
				<ArrowDownIcon size={18} />
			) : (
				<span className={styles.fileDetail}>
					{formatSize(file.size)}
					<ArrowDownIcon size={15} />
				</span>
			)}
		</a>
	) : (
		<span className={primary ? styles.disabledButton : styles.fileUnavailable} aria-disabled="true">
			<span>{label}</span>
			<span>{unavailableLabel}</span>
		</span>
	);
}
function ReleaseDetails({release}: {release?: DesktopRelease}) {
	return (
		<div className={styles.releaseDetails}>
			{release ? (
				<>
					<span>
						<span>v</span>
						{release.version}
					</span>
					{release.published && !Number.isNaN(Date.parse(release.published)) && (
						<span>
							{new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric', year: 'numeric'}).format(
								new Date(release.published),
							)}
						</span>
					)}
					{release.notes && (
						<a href={release.notes} rel="noopener noreferrer">
							<span>Release notes</span>
							<ArrowUpRightIcon size={12} />
						</a>
					)}
				</>
			) : (
				<span>No published build for this selection</span>
			)}
		</div>
	);
}
export default function DownloadPage() {
	const [channel, setChannel] = useState<ReleaseChannel>('stable');
	const [platform, setPlatform] = useState<DesktopPlatform>(() => detectPlatform(navigator.userAgent) ?? 'win32');
	const [architectures, setArchitectures] = useState<Record<DesktopPlatform, DesktopArch>>(() => ({
		win32: detectArch(navigator.userAgent),
		darwin: detectArch(navigator.userAgent),
		linux: detectArch(navigator.userAgent),
	}));
	const [catalog, setCatalog] = useState<DownloadCatalog | null>(null);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const [attempt, setAttempt] = useState(0);
	const detected = detectPlatform(navigator.userAgent);
	const chooseArch = useCallback(
		(os: DesktopPlatform, arch: DesktopArch) => setArchitectures((current) => ({...current, [os]: arch})),
		[],
	);
	useEffect(() => {
		const previous = document.title;
		document.title = 'Download Relay — Your people, closer.';
		return () => {
			document.title = previous;
		};
	}, []);
	useEffect(() => {
		const controller = new AbortController();
		let active = true;
		setStatus('loading');
		setCatalog(null);
		const timeout = window.setTimeout(() => controller.abort(), 20000);
		void loadDownloadCatalog(channel, controller.signal)
			.then((next) => {
				if (active) {
					setCatalog(next);
					setStatus('ready');
				}
			})
			.catch(() => {
				if (active) setStatus('error');
			})
			.finally(() => window.clearTimeout(timeout));
		return () => {
			active = false;
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [channel, attempt]);
	const releaseFor = (os: DesktopPlatform) =>
		catalog?.releases.find((item) => item.platform === os && item.arch === architectures[os]);
	const selected = releaseFor(platform);
	const primaryFormat = FORMATS[platform].find((format) => selected?.files[format]);
	const primaryFile = primaryFormat ? selected?.files[primaryFormat] : undefined;
	const Icon = platformIcons[platform];
	const changeChannel = (next: ReleaseChannel) => {
		if (next !== channel) {
			setCatalog(null);
			setStatus('loading');
			setChannel(next);
		}
	};
	let catalogMessage = <span>Checking release availability…</span>;
	if (status === 'error')
		catalogMessage = (
			<span>
				<span>We couldn’t check downloads.</span>{' '}
				<button type="button" onClick={() => setAttempt((value) => value + 1)}>
					Try again
				</button>{' '}
				<span>or</span> <a href="/login">open the browser app</a>
				<span>.</span>
			</span>
		);
	else if (status === 'ready') {
		if (catalog?.failedCoordinates)
			catalogMessage = (
				<span>
					<span>Some builds couldn’t be checked. Only confirmed downloads are shown.</span>{' '}
					<button type="button" onClick={() => setAttempt((value) => value + 1)}>
						Retry
					</button>
				</span>
			);
		else if (!catalog?.releases.length)
			catalogMessage = <span>No desktop downloads are available here yet. Use Relay in your browser.</span>;
		else catalogMessage = <span>{`Showing published ${channel === 'stable' ? 'Stable' : 'Canary'} builds.`}</span>;
	}
	return (
		<main className={styles.page}>
			<a className={styles.skipLink} href="#platforms">
				Skip to downloads
			</a>
			<div className={styles.ambient} aria-hidden="true" />
			<header className={styles.header}>
				<a className={styles.brand} href="/" aria-label="Relay home">
					<RelayMark aria-hidden="true" />
					<span>relay</span>
				</a>
				<nav className={styles.nav} aria-label="Main navigation">
					<a className={styles.activeNav} href="/download" aria-current="page">
						Download
					</a>
					<a href="#platforms">All platforms</a>
				</nav>
				<a className={styles.browserLink} href="/login">
					<span>Open Relay</span>
					<ArrowUpRightIcon size={15} />
				</a>
			</header>
			<section className={styles.hero} aria-labelledby="download-title">
				<div className={styles.heroCopy}>
					<div className={styles.eyebrow}>
						<span className={styles.statusDot} />
						<span>A space for your people</span>
					</div>
					<h1 id="download-title">
						<span>Good company.</span>
						<br />
						<span>One click closer.</span>
					</h1>
					<p className={styles.intro}>
						The conversations, late-night calls, and little moments that bring you together. Make room for them on your
						desktop.
					</p>
					<div className={styles.channelPicker} role="group" aria-label="Release channel">
						{(['stable', 'canary'] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={channel === value}
								onClick={() => changeChannel(value)}
								className={channel === value ? styles.selectedChannel : undefined}
							>
								{value === 'stable' ? 'Stable' : 'Canary'}
								{value === 'stable' && <span>Recommended</span>}
							</button>
						))}
					</div>
					<p className={styles.channelDescription}>
						{channel === 'stable'
							? 'The everyday version. Built for feeling at home.'
							: 'A first look at what’s next. Early builds may have rough edges.'}
					</p>
					<div className={styles.primaryDownload}>
						<div className={styles.selection}>
							<label>
								<span>Platform</span>
								<select value={platform} onChange={(event) => setPlatform(event.target.value as DesktopPlatform)}>
									{PLATFORMS.map((os) => (
										<option key={os} value={os}>
											{PLATFORM_NAMES[os]}
										</option>
									))}
								</select>
							</label>
							<label>
								<span>Architecture</span>
								<select
									value={architectures[platform]}
									onChange={(event) => chooseArch(platform, event.target.value as DesktopArch)}
								>
									{ARCHES.map((arch) => (
										<option key={arch} value={arch}>
											{archLabel(platform, arch)}
										</option>
									))}
								</select>
							</label>
						</div>
						<div className={styles.heroAction}>
							<Icon size={24} weight="fill" />
							{status === 'loading' ? (
								<span className={styles.disabledButton} aria-disabled="true">
									Checking available builds…
								</span>
							) : (
								<ArtifactLink primary file={primaryFile} label={`Download for ${PLATFORM_NAMES[platform]}`} />
							)}
						</div>
						<div className={styles.heroMeta}>
							{primaryFile && primaryFormat && (
								<span>
									{FORMAT_LABELS[primaryFormat]}
									{formatSize(primaryFile.size) && ` · ${formatSize(primaryFile.size)}`}
								</span>
							)}
							<span>
								{detected
									? `${PLATFORM_NAMES[detected]} detected · ${archLabel(platform, architectures[platform])}`
									: 'Choose your desktop above, or use the browser app'}
							</span>
						</div>
						<ReleaseDetails release={selected} />
						{status === 'ready' && !primaryFile && (
							<p className={styles.unavailableNote}>
								<span>{`This ${channel === 'canary' ? 'Canary ' : ''}build is not available right now.`}</span>{' '}
								<a href="/login">
									<span>Use Relay in your browser</span>
									<ArrowRightIcon size={13} />
								</a>
							</p>
						)}
					</div>
				</div>
				<div className={styles.visual} role="img" aria-label="Illustration of the Relay desktop experience">
					<div className={styles.orbit} aria-hidden="true" />
					<div className={styles.appIcon}>
						<RelayMark aria-hidden="true" />
					</div>
					<div className={styles.preview}>
						<div className={styles.windowBar}>
							<span className={styles.windowDots}>
								<i />
								<i />
								<i />
							</span>
							<span>relay · your space</span>
							<span className={styles.previewPill}>DESKTOP</span>
						</div>
						<div className={styles.windowBody}>
							<aside className={styles.previewSidebar} aria-hidden="true">
								<span className={styles.previewAvatar}>r</span>
								<span className={styles.previewServer}>✳</span>
								<span className={styles.previewServer}>+</span>
							</aside>
							<div className={styles.conversation}>
								<div className={styles.conversationHeader}>
									<span># the-living-room</span>
									<span className={styles.onlineDot} /> <small>Your people, right here</small>
								</div>
								<div className={styles.message}>
									<span className={styles.avatarPurple}>J</span>
									<div>
										<strong>
											<span>Jamie</span>
											<small>just now</small>
										</strong>
										<p>Same place, same people?</p>
									</div>
								</div>
								<div className={styles.message}>
									<span className={styles.avatarGreen}>S</span>
									<div>
										<strong>
											<span>Sam</span>
											<small>just now</small>
										</strong>
										<p>Wouldn’t miss it. ✨</p>
										<span className={styles.reaction}>💜 2</span>
									</div>
								</div>
								<div className={styles.voiceRoom}>
									<span className={styles.callIcon}>
										<WaveformIcon size={22} />
									</span>
									<div>
										<strong>A little more together.</strong>
										<small>The living room · Voice connected</small>
									</div>
									<VideoCameraIcon size={22} />
								</div>
								<div className={styles.messageInput}>
									<span>Message your people…</span>
									<span>＋</span>
								</div>
							</div>
						</div>
					</div>
					<div className={styles.visualCaption}>
						<span>
							<CheckIcon size={13} />
							<span>A familiar place. A native feel.</span>
						</span>
						<small>Interface illustration</small>
					</div>
				</div>
			</section>
			<section className={styles.platforms} id="platforms" aria-labelledby="platforms-title">
				<div className={styles.sectionHeading}>
					<div>
						<p className={styles.overline}>AT HOME ON YOUR DESKTOP</p>
						<h2 id="platforms-title">Your platform. Your people.</h2>
					</div>
					<p>
						<span>Pick your setup.</span>
						<br />
						<span>We’ll meet you there.</span>
					</p>
				</div>
				<div className={styles.catalogStatus} role="status" aria-live="polite">
					{catalogMessage}
				</div>
				<div className={styles.platformGrid}>
					{PLATFORMS.map((os) => {
						const PlatformIcon = platformIcons[os];
						const release = releaseFor(os);
						return (
							<article className={styles.platformCard} key={os}>
								<div className={styles.platformHeading}>
									<PlatformIcon size={30} weight="fill" />
									<span>{PLATFORM_NAMES[os]}</span>
									{detected === os && <span className={styles.detectedTag}>Your OS</span>}
								</div>
								<p className={styles.platformDescription}>{PLATFORM_DESCRIPTIONS[os]}</p>
								<label className={styles.cardSelect}>
									<span>{os === 'darwin' ? 'Choose your Mac’s chip' : 'Choose your architecture'}</span>
									<select
										value={architectures[os]}
										onChange={(event) => chooseArch(os, event.target.value as DesktopArch)}
									>
										{ARCHES.map((arch) => (
											<option value={arch} key={arch}>
												{archLabel(os, arch)}
											</option>
										))}
									</select>
								</label>
								<div className={styles.files}>
									{FORMATS[os].map((format) => (
										<ArtifactLink
											key={format}
											file={status === 'ready' ? release?.files[format] : undefined}
											label={FORMAT_LABELS[format]}
											unavailableLabel={status === 'loading' ? 'Checking…' : 'Not available'}
										/>
									))}
								</div>
								<ReleaseDetails release={release} />
								{release?.minimumSystemVersion && (
									<p className={styles.systemVersion}>
										<span>Requires</span>
										{PLATFORM_NAMES[os]} {release.minimumSystemVersion}
										<span>or later</span>
									</p>
								)}
							</article>
						);
					})}
				</div>
			</section>
			<section className={styles.browserSection}>
				<div className={styles.browserArtwork}>
					<ChatCircleDotsIcon size={30} />
				</div>
				<div>
					<h2>No download? No distance.</h2>
					<p>Jump into the conversation from your browser.</p>
				</div>
				<a href="/login">
					<span>Open Relay in browser</span>
					<ArrowUpRightIcon size={17} />
				</a>
			</section>
			<footer className={styles.footer}>
				<a className={styles.brand} href="/">
					<RelayMark aria-hidden="true" />
					<span>relay</span>
				</a>
				<p>A little closer, wherever you are.</p>
				<span>Built on open source. With attribution to Fluxer.</span>
			</footer>
		</main>
	);
}
