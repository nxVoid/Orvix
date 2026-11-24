// SPDX-License-Identifier: AGPL-3.0-or-later

export type ReleaseChannel = 'stable' | 'canary';
export type DesktopPlatform = 'win32' | 'darwin' | 'linux';
export type DesktopArch = 'x64' | 'arm64';
export type DownloadFormat = 'setup' | 'portable' | 'dmg' | 'zip' | 'appimage' | 'deb' | 'rpm' | 'tar_gz';
export interface DownloadFile {
	url: string;
	size: number | null;
	sha256: string | null;
}
export interface DesktopRelease {
	channel: ReleaseChannel;
	platform: DesktopPlatform;
	arch: DesktopArch;
	version: string;
	published: string | null;
	notes: string | null;
	minimumSystemVersion: string | null;
	files: Partial<Record<DownloadFormat, DownloadFile>>;
}
export interface DownloadCatalog {
	releases: Array<DesktopRelease>;
	failedCoordinates: number;
	configured: boolean;
}
export const PLATFORMS: Array<DesktopPlatform> = ['win32', 'darwin', 'linux'];
export const ARCHES: Array<DesktopArch> = ['x64', 'arm64'];
export const FORMATS: Record<DesktopPlatform, Array<DownloadFormat>> = {
	win32: ['setup', 'portable'],
	darwin: ['dmg', 'zip'],
	linux: ['appimage', 'deb', 'rpm', 'tar_gz'],
};
export const FORMAT_LABELS: Record<DownloadFormat, string> = {
	setup: 'Installer',
	portable: 'Portable ZIP',
	dmg: 'DMG',
	zip: 'ZIP',
	appimage: 'AppImage',
	deb: 'DEB',
	rpm: 'RPM',
	tar_gz: 'tar.gz',
};
export const PLATFORM_NAMES: Record<DesktopPlatform, string> = {win32: 'Windows', darwin: 'macOS', linux: 'Linux'};
export const METADATA_PATH = '/assets/relay-downloads.json';

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}
/** Only web URLs are downloadable. Never turn an absent format into a guessed download route. */
export function safeDownloadUrl(value: unknown, base: string): string | null {
	const raw = text(value);
	if (!raw) return null;
	try {
		const url = new URL(raw, base);
		return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}
export function parseRelease(
	value: unknown,
	base: string,
	coordinate?: {channel: ReleaseChannel; platform: DesktopPlatform; arch: DesktopArch},
): DesktopRelease | null {
	if (!record(value)) return null;
	const channel = value.channel ?? coordinate?.channel;
	const platform = value.platform ?? coordinate?.platform;
	const arch = value.arch ?? coordinate?.arch;
	const version = text(value.version);
	if (
		(channel !== 'stable' && channel !== 'canary') ||
		!PLATFORMS.includes(platform as DesktopPlatform) ||
		!ARCHES.includes(arch as DesktopArch) ||
		!version ||
		!record(value.files)
	)
		return null;
	if (coordinate && (channel !== coordinate.channel || platform !== coordinate.platform || arch !== coordinate.arch))
		return null;
	const files: DesktopRelease['files'] = {};
	for (const format of FORMATS[platform as DesktopPlatform]) {
		const entry = value.files[format];
		// Existing CI manifest.json entries are filename strings or {filename, sha256}.
		let filename = typeof entry === 'string' ? entry : null;
		if (record(entry)) filename = text(entry.filename);
		// Filenames must remain a single artifact name, never escape their coordinate directory.
		const validFilename =
			filename &&
			!/[\\/]/u.test(filename) &&
			!Array.from(filename).some((char) => char.charCodeAt(0) < 32) &&
			filename !== '.' &&
			filename !== '..'
				? filename
				: null;
		const url = safeDownloadUrl(
			(record(entry) ? text(entry.url) : null) ?? (validFilename ? encodeURIComponent(validFilename) : null),
			base,
		);
		if (!url) continue;
		const size = record(entry) ? (entry.size ?? entry.bytes) : null;
		const sha256 =
			record(entry) && typeof entry.sha256 === 'string' && /^[a-f\d]{64}$/iu.test(entry.sha256) ? entry.sha256 : null;
		files[format] = {
			url,
			size: typeof size === 'number' && Number.isSafeInteger(size) && size > 0 ? size : null,
			sha256,
		};
	}
	return {
		channel,
		platform: platform as DesktopPlatform,
		arch: arch as DesktopArch,
		version,
		published: text(value.pub_date),
		notes: safeDownloadUrl(value.release_notes_url, base),
		minimumSystemVersion: text(value.minimum_system_version),
		files,
	};
}

export function detectPlatform(userAgent: string): DesktopPlatform | null {
	if (/Android|iPhone|iPad|iPod/iu.test(userAgent)) return null;
	if (/Windows/iu.test(userAgent)) return 'win32';
	if (/Macintosh|Mac OS/iu.test(userAgent)) return 'darwin';
	if (/Linux|X11/iu.test(userAgent)) return 'linux';
	return null;
}
export function detectArch(userAgent: string): DesktopArch {
	return /arm64|aarch64/iu.test(userAgent) ? 'arm64' : 'x64';
}
export function formatSize(size: number | null): string | null {
	return size === null
		? null
		: `${new Intl.NumberFormat('en', {maximumFractionDigits: 1}).format(size / 1024 / 1024)} MB`;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
	const response = await fetch(url, {signal, credentials: 'omit', cache: 'no-store'});
	if (!response.ok) throw new Error(`Release metadata returned ${response.status}`);
	return response.json();
}

/** Uses the package service's documented latest endpoint, then its checked-in CI manifest format. */
export async function loadDownloadCatalog(
	channel: ReleaseChannel,
	signal: AbortSignal,
	base = window.location.origin,
): Promise<DownloadCatalog> {
	const config = await fetchJson(new URL(METADATA_PATH, base).href, signal);
	if (!record(config) || config.schema_version !== 1 || !Array.isArray(config.releases))
		throw new Error('Unsupported download configuration');
	const releases = config.releases
		.map((item) => parseRelease(item, `${base}/`))
		.filter((item): item is DesktopRelease => item !== null && item.channel === channel);
	const origin = safeDownloadUrl(config.package_origin, `${base}/`);
	if (config.package_origin !== null && config.package_origin !== undefined && !origin)
		throw new Error('Invalid package origin');
	if (!origin) return {releases, failedCoordinates: 0, configured: releases.length > 0};
	const originUrl = new URL(origin);
	if (originUrl.search || originUrl.hash) throw new Error('Package origin cannot contain a query or fragment');
	let failedCoordinates = 0;
	// Two requests at a time at most; switching channels aborts all outstanding requests.
	const coordinates = PLATFORMS.flatMap((platform) => ARCHES.map((arch) => ({channel, platform, arch})));
	for (let i = 0; i < coordinates.length; i += 2) {
		await Promise.all(
			coordinates.slice(i, i + 2).map(async (coordinate) => {
				const directory = `${origin.replace(/\/$/u, '')}/desktop/${channel}/${coordinate.platform}/${coordinate.arch}/`;
				try {
					let value: unknown;
					try {
						value = await fetchJson(`${directory}latest`, signal);
					} catch (error) {
						if (signal.aborted) throw error;
						value = await fetchJson(`${directory}manifest.json`, signal);
					}
					const release = parseRelease(value, directory, coordinate);
					if (!release) throw new Error('Invalid coordinate metadata');
					// A successful feed replaces manually listed metadata for the same coordinate.
					const index = releases.findIndex((item) => item.platform === release.platform && item.arch === release.arch);
					if (index >= 0) releases.splice(index, 1);
					releases.push(release);
				} catch (error) {
					if (signal.aborted) throw error;
					failedCoordinates++;
				}
			}),
		);
	}
	return {releases, failedCoordinates, configured: true};
}
