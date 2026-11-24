// SPDX-License-Identifier: AGPL-3.0-or-later
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	const port = 9223;
	const chromePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
	const baseTmp = fs.existsSync('/mnt/c/Users/ufukw/AppData/Local/Temp')
		? '/mnt/c/Users/ufukw/AppData/Local/Temp'
		: os.tmpdir();
	const profile = fs.mkdtempSync(path.join(baseTmp, 'orvix-ui-capture-'));
	const profileArg = profile.startsWith('/mnt/c/')
		? 'C:' + profile.slice('/mnt/c'.length).replace(/\//g, '\\')
		: profile;

	const browser = spawn(
		chromePath,
		[
			'--headless=new',
			`--remote-debugging-port=${port}`,
			`--user-data-dir=${profileArg}`,
			'--window-size=1440,900',
			'--no-first-run',
			'about:blank',
		],
		{stdio: 'ignore'},
	);

	try {
		let tabs;
		for (let i = 0; i < 30; i++) {
			try {
				const r = await fetch(`http://127.0.0.1:${port}/json/list`);
				if (r.ok) {
					tabs = await r.json();
					if (Array.isArray(tabs) && tabs.length && tabs.find((t) => t.type === 'page')) break;
				}
			} catch {}
			await delay(300);
		}

		if (!tabs || !tabs.length) throw new Error('Could not connect to Chrome');
		const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
		const wsUrl = pageTab.webSocketDebuggerUrl;

		const ws = new globalThis.WebSocket(wsUrl);
		await new Promise((resolve) => {
			ws.addEventListener('open', resolve, {once: true});
		});

		let nextId = 1;
		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const id = nextId++;
				const handler = (event) => {
					const msg = JSON.parse(event.data.toString());
					if (msg.id === id) {
						ws.removeEventListener('message', handler);
						if (msg.error) reject(msg.error);
						else resolve(msg.result);
					}
				};
				ws.addEventListener('message', handler);
				ws.send(JSON.stringify({id, method, params}));
			});

		await send('Page.enable');
		await send('DOM.enable');

		console.log('Navigating to http://127.0.0.1:3000/channels/@me ...');
		await send('Page.navigate', {url: 'http://127.0.0.1:3000/channels/@me'});
		await delay(4000);

		const shot = await send('Page.captureScreenshot', {format: 'png'});
		const outPath = '/tmp/relay-ui-transformed.png';
		fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
		console.log('Screenshot saved to', outPath);

		ws.close();
	} finally {
		browser.kill('SIGTERM');
		setTimeout(() => {
			try {
				browser.kill('SIGKILL');
			} catch {}
		}, 1000);
	}
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
