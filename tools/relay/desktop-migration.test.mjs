// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {test} from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
function loadTypeScript(name, dependencies) {
	const source = fs.readFileSync(path.join(root, name), 'utf8');
	const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
	const module = {exports: {}};
	new Function('require', 'module', 'exports', compiled)(
		(name) => {
			if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
			return dependencies[name];
		},
		module,
		module.exports,
	);
	return module.exports;
}

test('Relay and existing Orvix links resolve to the foreground account without accepting an instance override', () => {
	const sent = [];
	const window = {isDestroyed: () => false, webContents: {send: (...args) => sent.push(args)}};
	const links = loadTypeScript('relay_desktop/src/main/DeepLinks.ts', {
		'@electron/common/Constants': {APP_PROTOCOLS: ['relay', 'orvix']},
		'@electron/main/DesktopTray': {},
		'@electron/main/DesktopUpdatePrompt': {},
		'@electron/main/JumpList': {},
		'@electron/main/LaunchOptions': {},
		'@electron/main/Window': {getMainWindow: () => window, isMainWindowTakenOver: () => false, showWindow: () => {}},
		electron: {app: {addRecentDocument: () => {}}, ipcMain: {}},
		'electron-log': {warn: () => {}, debug: () => {}},
	});
	links.handleOpenUrl('relay://channels/123');
	links.handleOpenUrl('orvix://channels/456');
	assert.deepEqual(sent, [
		['deep-link', '/channels/123'],
		['deep-link', '/channels/456'],
	]);
	for (const url of ['relay://channels/123?instance=evil.invalid', 'orvix://host/123', 'https://channels/123']) {
		links.handleOpenUrl(url);
	}
	assert.equal(sent.length, 2);
	const handoffs = [];
	links.setHandoffReturnLinkSink((url) => handoffs.push(url.protocol));
	links.handleOpenUrl('relay://handoff/return');
	links.handleOpenUrl('orvix://handoff/return');
	assert.deepEqual(handoffs, ['relay:', 'orvix:']);
});

test('update origin accepts Relay configuration and the existing deployment setting', () => {
	const previous = {relay: process.env.RELAY_DESKTOP_PACKAGE_ORIGIN, orvix: process.env.ORVIX_DESKTOP_PACKAGE_ORIGIN};
	try {
		process.env.ORVIX_DESKTOP_PACKAGE_ORIGIN = 'https://legacy.example.invalid/';
		process.env.RELAY_DESKTOP_PACKAGE_ORIGIN = 'https://relay.example.invalid///';
		const formats = loadTypeScript('relay_desktop/src/main/ShellDownloadFormats.ts', {
			'@electron/common/BuildChannel': {BUILD_CHANNEL: 'stable'},
		});
		assert.equal(formats.resolveDesktopPackageOrigin(), 'https://relay.example.invalid');
		delete process.env.RELAY_DESKTOP_PACKAGE_ORIGIN;
		assert.equal(formats.resolveDesktopPackageOrigin(), 'https://legacy.example.invalid');
	} finally {
		for (const [key, value] of Object.entries({
			RELAY_DESKTOP_PACKAGE_ORIGIN: previous.relay,
			ORVIX_DESKTOP_PACKAGE_ORIGIN: previous.orvix,
		})) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});
