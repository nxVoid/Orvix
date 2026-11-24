// SPDX-License-Identifier: AGPL-3.0-or-later
// Run with Windows Node and Chrome; see docs/3d-rooms/testing.md.
const fs = require('node:fs'),
	os = require('node:os'),
	path = require('node:path'),
	{spawn} = require('node:child_process');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	const net = require('node:net');
	const port = process.env.CHROME_PORT ? parseInt(process.env.CHROME_PORT, 10) : 9222;
	const isWsl = process.platform === 'linux' && fs.existsSync('/mnt/c/Program Files/Google/Chrome/Application/chrome.exe');
	const chromePath = isWsl
		? '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
		: 'C:/Program Files/Google/Chrome/Application/chrome.exe';
	const baseTmp = isWsl && fs.existsSync('/mnt/c/Users/ufukw/AppData/Local/Temp')
		? '/mnt/c/Users/ufukw/AppData/Local/Temp'
		: os.tmpdir();
	const profile = fs.mkdtempSync(path.join(baseTmp, 'orvix-3d-check-'));
	const profileArg = isWsl && profile.startsWith('/mnt/c/')
		? 'C:' + profile.slice('/mnt/c'.length).replace(/\//g, '\\')
		: profile;
	const browser = spawn(
		chromePath,
		[
			'--headless=new',
			`--remote-debugging-port=${port}`,
			`--user-data-dir=${profileArg}`,
			'--no-first-run',
			'about:blank',
		],
		{stdio: 'ignore'},
	);
	let ws;
	const pending = new Map();
	let id = 0;
	const errors = [],
		responses = [];
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
			await delay(400);
		}
		if (!tabs || !tabs.length) throw new Error(`Could not connect to Chrome DevTools on port ${port}`);
		ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			ws.onopen = resolve;
			ws.onerror = reject;
		});
		ws.onmessage = (e) => {
			const m = JSON.parse(e.data);
			if (m.id) {
				const p = pending.get(m.id);
				if (p) {
					pending.delete(m.id);
					clearTimeout(p.timer);
					m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
				}
			} else if (m.method === 'Runtime.exceptionThrown')
				errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
			else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
				errors.push(m.params.args.map((x) => x.value || x.description || '').join(' '));
			else if (m.method === 'Network.responseReceived' && /well-known|\/api\/ip/.test(m.params.response.url)) {
				const r = m.params.response;
				responses.push({url: r.url, status: r.status, mime: r.mimeType});
			}
		};
		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const msgId = ++id;
				const timer = setTimeout(() => {
					pending.delete(msgId);
					reject(new Error(`CDP timeout ${method}`));
				}, 12000);
				pending.set(msgId, {resolve, reject, timer});
				ws.send(JSON.stringify({id: msgId, method, params}));
			});
		await send('Performance.enable');
		await send('Page.enable');
		await send('Runtime.enable');
		await send('Network.enable');
		await send('Page.navigate', {url: 'http://localhost:18755/.relay/runtime/rooms3d-preview/index.html'});
		await delay(4500);
		const evaluate = async (expression) =>
			(await send('Runtime.evaluate', {expression, returnByValue: true})).result.value;
		const initial = JSON.parse(await evaluate('JSON.stringify(window.roomFixture)'));
		const version = await send('Browser.getVersion');
		const hardware = JSON.parse(
			await evaluate(
				'JSON.stringify({cores:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,renderer:(()=>{const g=document.querySelector("canvas").getContext("webgl2");const e=g.getExtension("WEBGL_debug_renderer_info");return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):"unavailable"})()})',
			),
		);
		await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
		await delay(700);
		const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
		fs.writeFileSync(path.join(os.tmpdir(), 'orvix-3d-gaming.png'), Buffer.from(shot.data, 'base64'));
		if (fs.existsSync('docs/3d-rooms/previews')) {
			fs.writeFileSync('docs/3d-rooms/previews/gaming-lounge.png', Buffer.from(shot.data, 'base64'));
		}
		const bounds = JSON.parse(
			await evaluate('JSON.stringify(document.querySelector("canvas")?.getBoundingClientRect())'),
		);
		const checks = {};
		if (bounds) {
			await send('Input.dispatchMouseEvent', {
				type: 'mousePressed',
				x: bounds.x + 500,
				y: bounds.y + 300,
				button: 'left',
				clickCount: 1,
			});
			await send('Input.dispatchMouseEvent', {
				type: 'mouseReleased',
				x: bounds.x + 500,
				y: bounds.y + 300,
				button: 'left',
				clickCount: 1,
			});
			await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87});
			await delay(250);
			checks.movement = await evaluate('Math.hypot(window.roomFixture.motion.x,window.roomFixture.motion.z)>0');
			await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87});
			await evaluate('document.querySelector("#chat").focus()');
			await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87});
			await delay(100);
			checks.typingDoesNotMove = await evaluate(
				'Math.hypot(window.roomFixture.motion.x,window.roomFixture.motion.z)===0',
			);
			await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87});
			const metrics = {};
			for (const template of ['gaming', 'meeting', 'cinema', 'rooftop']) {
				await evaluate(
					`document.querySelector('#template').value='${template}';document.querySelector('#template').dispatchEvent(new Event('change',{bubbles:true}))`,
				);
				await delay(1500);
				metrics[template] = JSON.parse(await evaluate('JSON.stringify(window.roomFixture.metrics)'));
			}
			checks.templates = metrics;
			await evaluate('document.querySelector("#share").click()');
			await delay(1500);
			checks.screenTextureMetrics = JSON.parse(await evaluate('JSON.stringify(window.roomFixture.metrics)'));
			const videoStarts = await evaluate('window.roomFixture.videoStarts');
			await delay(2100);
			checks.screenDoesNotRestartOnSnapshots = videoStarts > 0 && videoStarts === await evaluate('window.roomFixture.videoStarts');

			checks.cleanup = [];
			for (let i = 0; i < 3; i++) {
				await evaluate('document.querySelector("#toggle").click()');
				await delay(150);
				const off = await evaluate('document.querySelectorAll("canvas").length');
				await evaluate('document.querySelector("#toggle").click()');
				await delay(500);
				const on = await evaluate('document.querySelectorAll("canvas").length');
				checks.cleanup.push({
					off,
					on,
					sourceTrackRetained: await evaluate('window.roomFixture.screenTrack.readyState === "live"'),
				});
			}
			await evaluate(
				'document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()',
			);
			await delay(100);
			checks.contextLossHandled = await evaluate('window.roomFixture.failure');
		}
		const perf = await send('Performance.getMetrics');
		const result = {
			version,
			hardware,
			initial,
			checks,
			heap: perf.metrics.filter((x) => ['JSHeapUsedSize', 'Nodes'].includes(x.name)),
			errors,
		};
		fs.writeFileSync(path.join(os.tmpdir(), 'orvix-3d-browser-results.json'), JSON.stringify(result, null, 2));
		if (fs.existsSync('docs/3d-rooms/previews')) {
			fs.writeFileSync('docs/3d-rooms/previews/browser-results.json', JSON.stringify(result, null, 2));
		}
		console.log(JSON.stringify(result, null, 2));
		const boneChecks = initial.avatarChecks;
		if (
			!Array.isArray(boneChecks) ||
			boneChecks.length !== 2 ||
			boneChecks.some(
				(m) =>
					!m.clipsPresent ||
					!m.walkMovesBones ||
					!m.runMovesBones ||
					!m.reducedWalkMoves ||
					!m.reducedIdleStill ||
					!m.independentSkeleton,
			)
		)
			throw new Error('Avatar GLB animation regression failed');
		if (
			initial.failure ||
			!checks.movement ||
			!checks.typingDoesNotMove ||
			!checks.screenDoesNotRestartOnSnapshots ||
			!checks.contextLossHandled ||
			checks.cleanup.some((x) => x.off !== 0 || x.on !== 1 || !x.sourceTrackRetained)
		)
			throw new Error('3D browser regression check failed');
		await send('Browser.close').catch(() => {});
	} finally {
		ws?.close();
		browser.kill();
		try {
			fs.rmSync(profile, {recursive: true, force: true});
		} catch {}
	}
})().catch((e) => {
	console.error(e.message);
	process.exitCode = 1;
});
