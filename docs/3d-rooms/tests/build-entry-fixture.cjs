const {createRequire} = require('node:module');
const path = require('node:path');
const appRequire = createRequire(path.resolve('relay_app/package.json'));
appRequire('esbuild')
	.build({
		entryPoints: ['docs/3d-rooms/tests/entry-fixture.tsx'],
		nodePaths: [path.resolve('relay_app/node_modules')],
		bundle: true,
		format: 'esm',
		jsx: 'automatic',
		outfile: '.relay/runtime/rooms3d-preview/entry.js',
		loader: {'.css': 'local-css'},
		define: {'process.env.NODE_ENV': '"development"'},
		plugins: [
			{
				name: 'isolated-entry-test-boundaries',
				setup(build) {
					build.onResolve({filter: /^@app\/features\/platform\/transport\/RestTransport$/}, () => ({
						path: 'http',
						namespace: 'test-boundary',
					}));
					build.onResolve({filter: /^@lingui\/react\/macro$/}, () => ({path: 'lingui', namespace: 'test-boundary'}));
					build.onResolve({filter: /^@app\/features\/voice\/components\/VoiceControlBar.module.css$/}, () => ({
						path: path.resolve('relay_app/src/features/voice/components/VoiceControlBar.module.css'),
					}));
					build.onResolve({filter: /^@app\/features\/ui\/(focus_ring\/FocusRing|tooltip\/Tooltip)$/}, () => ({
						path: 'wrappers',
						namespace: 'test-boundary',
					}));
					build.onResolve({filter: /^\.\/RoomPanel$/}, (args) =>
						args.importer.endsWith('Room3dEntry.tsx') ? {path: 'panel', namespace: 'test-boundary'} : undefined,
					);
					build.onLoad({filter: /.*/, namespace: 'test-boundary'}, (args) => ({
						loader: 'jsx',
						resolveDir: path.resolve('relay_app'),
						contents:
							args.path === 'http'
								? `export const http={get:async()=>{window.roomEntryHarness.requests++;return {body:{enabled:window.roomEntryHarness.enabled}}}};`
								: args.path === 'wrappers'
									? `export default function FocusRing({children}){return children} export function Tooltip({children}){return children}`
									: args.path === 'lingui'
										? `export function Trans({children}){return children} export const useLingui=()=>({t:strings=>strings.join('')})`
										: `export default function Panel({onExit}){return <div role="dialog" id="test-room-panel"><button id="exit-room" type="button" onClick={onExit}>Return to voice</button></div>}`,
					}));
				},
			},
		],
	})
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	});
