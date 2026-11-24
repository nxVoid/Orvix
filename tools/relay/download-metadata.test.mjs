// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {test} from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const source = fs.readFileSync(path.join(root, 'relay_app/src/features/download/DownloadMetadata.ts'), 'utf8');
const module = {exports: {}};
new Function('exports', ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText)(
	module.exports,
);
const {parseRelease, safeDownloadUrl, detectPlatform, detectArch, loadDownloadCatalog, formatSize} = module.exports;
const base = 'https://releases.example.invalid/desktop/stable/win32/x64/';
const coordinate = {channel: 'stable', platform: 'win32', arch: 'x64'};
const hash = 'a'.repeat(64);
const release = {...coordinate, version: 'test-version', files: {setup: {filename: 'Relay Setup.exe', sha256: hash}}};

test('existing CI manifests resolve only listed artifacts and retain checksums', () => {
	const parsed = parseRelease(release, base);
	assert.equal(parsed.files.setup.url, `${base}Relay%20Setup.exe`);
	assert.equal(parsed.files.setup.sha256, hash);
	assert.equal(parsed.files.portable, undefined);
	assert.equal(parsed.files.setup.size, null);
});
test('package latest metadata carries version, file size, release notes and absolute URLs', () => {
	const parsed = parseRelease(
		{
			...release,
			release_notes_url: '/notes/test',
			files: {setup: {url: 'https://cdn.example.invalid/setup.exe', size: 10485760}},
		},
		base,
	);
	assert.equal(parsed.version, 'test-version');
	assert.equal(formatSize(parsed.files.setup.size), '10 MB');
	assert.equal(parsed.notes, 'https://releases.example.invalid/notes/test');
});
test('formats from another operating system are not offered', () => {
	assert.deepEqual(
		parseRelease({...release, files: {dmg: {url: 'https://cdn.example.invalid/app.dmg'}}}, base).files,
		{},
	);
});
test('invalid coordinates, missing versions, credential URLs and executable schemes are rejected', () => {
	assert.equal(parseRelease({...release, channel: 'development'}, base), null);
	assert.equal(parseRelease({...release, version: ''}, base), null);
	assert.equal(parseRelease({...release, arch: 'arm64'}, base, coordinate), null);
	for (const value of [
		'javascript:alert(1)',
		'data:text/html,test',
		'file:///etc/passwd',
		'https://user:secret@example.invalid/a',
	])
		assert.equal(safeDownloadUrl(value, base), null);
});
test('filenames cannot escape their coordinate directory or become guessed URLs', () => {
	for (const filename of ['../setup.exe', '/setup.exe', '..', 'a\\setup.exe', `bad${String.fromCharCode(0)}.exe`])
		assert.deepEqual(parseRelease({...release, files: {setup: filename}}, base).files, {});
	assert.equal(parseRelease({...release, files: {setup: {filename: 'a.exe', bytes: -1}}}, base).files.setup.size, null);
});
test('desktop OS detection excludes mobile OSes and leaves unknown platforms unclassified', () => {
	assert.equal(detectPlatform('Windows NT 10.0; Win64; x64'), 'win32');
	assert.equal(detectPlatform('Macintosh; Intel Mac OS X'), 'darwin');
	assert.equal(detectPlatform('X11; Linux aarch64'), 'linux');
	for (const ua of ['Linux; Android 14', 'iPad; Mac OS X', 'iPhone', 'Unknown']) assert.equal(detectPlatform(ua), null);
	assert.equal(detectArch('Linux aarch64'), 'arm64');
});
async function mockedFetch(handler, run) {
	const before = globalThis.fetch;
	globalThis.fetch = handler;
	try {
		await run();
	} finally {
		globalThis.fetch = before;
	}
}
test('empty configuration offers no binaries and never contacts the upstream package service', async () => {
	const requests = [];
	await mockedFetch(
		async (url) => {
			requests.push(url);
			return Response.json({schema_version: 1, package_origin: null, releases: []});
		},
		async () => {
			const result = await loadDownloadCatalog('stable', new AbortController().signal, 'https://relay.example.invalid');
			assert.equal(result.configured, false);
			assert.deepEqual(result.releases, []);
			assert.equal(requests.length, 1);
		},
	);
});
test('manual GitHub/CDN release metadata is filtered by release channel', async () => {
	await mockedFetch(
		async () =>
			Response.json({schema_version: 1, package_origin: null, releases: [release, {...release, channel: 'canary'}]}),
		async () => {
			const result = await loadDownloadCatalog('canary', new AbortController().signal, 'https://relay.example.invalid');
			assert.equal(result.releases.length, 1);
			assert.equal(result.releases[0].channel, 'canary');
		},
	);
});
test('package feed uses at most two requests at once, falls back to CI manifests, and reports missing builds', async () => {
	let active = 0;
	let maxActive = 0;
	const paths = [];
	await mockedFetch(
		async (input) => {
			const url = String(input);
			paths.push(url);
			active++;
			maxActive = Math.max(active, maxActive);
			await new Promise((resolve) => setTimeout(resolve, 1));
			active--;
			if (url.endsWith('relay-downloads.json'))
				return Response.json({schema_version: 1, package_origin: 'https://packages.example.invalid', releases: []});
			if (url === `${base.replace('releases.example.invalid', 'packages.example.invalid')}manifest.json`)
				return Response.json(release);
			return new Response('Not found', {status: 404});
		},
		async () => {
			const result = await loadDownloadCatalog('stable', new AbortController().signal, 'https://relay.example.invalid');
			assert.equal(result.releases.length, 1);
			assert.equal(result.failedCoordinates, 5);
			assert.ok(maxActive <= 2);
			assert.ok(paths.some((url) => url.endsWith('/manifest.json')));
		},
	);
});
test('aborted channel loads do not continue fetching or become an empty successful catalog', async () => {
	const controller = new AbortController();
	await mockedFetch(
		async (url) => {
			if (String(url).endsWith('relay-downloads.json'))
				return Response.json({schema_version: 1, package_origin: 'https://packages.example.invalid', releases: []});
			controller.abort();
			throw new DOMException('Aborted', 'AbortError');
		},
		async () => {
			await assert.rejects(loadDownloadCatalog('stable', controller.signal, 'https://relay.example.invalid'));
		},
	);
});
