import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {root, write} from './workspace.mjs';

const require = createRequire(path.join(root, 'relay_app/package.json'));
const {parse} = require('@babel/parser');
const brand = /\b(?:Orvix|Fluxer|ORVIX|FLUXER|orvix|fluxer)\b/g;
const protectedText =
	/X-(?:Orvix|Fluxer)-[\w-]+|(?:@)?(?:orvix|fluxer)[:._/-][\w:./-]+|(?:https?|wss?|git):\/\/[^\s<>"'`\\]+|[\w.+-]+@[\w.-]+\.[A-Za-z]+|Fluxer Platform AB|Orvix (?:Sans|Fallback|Symbols|Math)/g;
export function displayCopy(value) {
	const saved = [];
	let text = value.replace(protectedText, (m) => `__BRAND_HOLD_${saved.push(m) - 1}__`);
	text = text.replace(brand, 'Relay');
	return text.replace(/__BRAND_HOLD_(\d+)__/g, (_, n) => saved[+n]);
}
function isDisplay(value) {
	if (!brand.test(value)) {
		brand.lastIndex = 0;
		return false;
	}
	brand.lastIndex = 0;
	if (/^(?:X-|@|__|[./]|ORVIX_|FLUXER_|orvix[:_.-]|fluxer[:_.-])/i.test(value)) return false;
	if (/(?:^|\s)(?:Copyright|SPDX-|org\.fluxer|app\.orvix|com\.fluxer)/i.test(value)) return false;
	if (/(?:Orvix|Fluxer)\.(?:exe|app|provisionprofile|desktop|dmg|dll)/.test(value)) return false;
	if (!/\s/.test(value) && !/^(?:Orvix|Fluxer|ORVIX|FLUXER)$/.test(value)) return false;
	return displayCopy(value) !== value;
}
const all = execFileSync('rg', ['--files'], {cwd: root, encoding: 'utf8'}).trim().split('\n');
const inventory = [];
let changed = 0,
	skipped = [];
for (const name of all) {
	if (
		!/\.(?:tsx?|rs|json|po|html|md|ya?ml|toml|mjs|cjs|css|svg|ex|erl|hrl|sh|go)$/.test(name) ||
		name.startsWith('tools/relay/')
	)
		continue;
	const source = fs.readFileSync(path.join(root, name), 'utf8');
	const count = (source.match(/orvix|fluxer/gi) ?? []).length;
	if (!count) continue;
	const category = /^\.devcontainer|docker|deployment|\.github|^config\//i.test(name)
		? 'Docker and deployment identifiers'
		: /database|postgres|UserDataPath|storage|auth\/|AuthRecoveryKit|RecoveryKeyUtils/i.test(name)
			? 'Database, authentication and persistent storage identifiers'
			: /Cargo|package.json|pnpm|build|tools\//i.test(name)
				? 'Package and build identifiers'
				: /LICENSE|NOTICE|CHANGELOG|legal|operator_pass_terms/i.test(name)
					? 'Legacy compatibility and legal references'
					: /relay_app\/src|templates|locales|email|index.html|branding/i.test(name)
						? 'User-facing branding candidates'
						: 'Internal Rust/TypeScript/Erlang identifiers';
	inventory.push({file: name, references: count, category});
	const excluded =
		/RelayAudioIdentity|ThemeVariableManifest|\.test\.|\/tests\/|\.generated\.|\/operator_pass_terms\/|\/legal\/|\/changelog|\/fonts\/|\/UserDataPath\.|\/BuildChannel\.|\/DesktopConstants\./i.test(
			name,
		);
	if (excluded) continue;
	let next = source;
	if (/^relay_app\/src\/|^relay_desktop\/src\//.test(name) && /\.tsx?$/.test(name)) {
		try {
			const ast = parse(source, {
				sourceType: 'unambiguous',
				plugins: ['typescript', ...(name.endsWith('.tsx') ? ['jsx'] : [])],
			});
			const edits = [];
			function walk(node, parent) {
				if (!node || typeof node !== 'object') return;
				if (['StringLiteral', 'JSXText', 'TemplateElement'].includes(node.type)) {
					const moduleLiteral =
						parent &&
						(['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'TSImportType'].includes(
							parent.type,
						) ||
							(parent.type === 'CallExpression' &&
								['require', 'import'].includes(parent.callee?.name ?? parent.callee?.type?.toLowerCase())));
					const propertyKey =
						parent &&
						['ObjectProperty', 'ObjectMethod'].includes(parent.type) &&
						parent.key === node &&
						!parent.computed;
					const value = node.type === 'TemplateElement' ? node.value.raw : node.value;
					if (!moduleLiteral && !propertyKey && typeof value === 'string' && isDisplay(value)) {
						const raw = source.slice(node.start, node.end);
						edits.push({start: node.start, end: node.end, value: displayCopy(raw)});
					}
				}
				for (const [key, value] of Object.entries(node))
					if (!['loc', 'start', 'end', 'extra', 'comments'].includes(key)) {
						if (Array.isArray(value)) for (const child of value) walk(child, node);
						else if (value && typeof value === 'object' && value.type) walk(value, node);
					}
			}
			walk(ast, null);
			edits.sort((a, b) => b.start - a.start);
			let last = Infinity;
			for (const e of edits) {
				if (e.end > last) continue;
				next = next.slice(0, e.start) + e.value + next.slice(e.end);
				last = e.start;
			}
		} catch {
			skipped.push(name);
			continue;
		}
	} else if (/\.po$/.test(name) && /^relay_app\//.test(name)) {
		next = source
			.split('\n')
			.map((line) => (/^(?:msgid|msgstr|msgid_plural|")/.test(line) ? displayCopy(line) : line))
			.join('\n');
	} else if (
		/\.json$/.test(name) &&
		/locales\//.test(name) &&
		/^(?:packages\/errors|relay_api\/pkgs\/email|relay_api\/src\/api\/content_i18n)/.test(name)
	) {
		const replace = (value) =>
			typeof value === 'string'
				? displayCopy(value)
				: Array.isArray(value)
					? value.map(replace)
					: value && typeof value === 'object'
						? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]))
						: value;
		next = `${JSON.stringify(replace(JSON.parse(source)), null, 2)}\n`;
	} else if (/^relay_admin\/src\/templates\//.test(name) && name.endsWith('.rs')) {
		// Maud text literals only. Keep headers, routes, module identifiers and interpolation intact.
		next = source.replace(/"(?:\\.|[^"\\])*"/g, (raw) => (isDisplay(raw.slice(1, -1)) ? displayCopy(raw) : raw));
	} else if (
		/^relay_docs\//.test(name) &&
		/\.(md|mdx)$/.test(name) &&
		!/changelog|legal|license|terms|security/i.test(name)
	) {
		// Documentation needs manual review of commands; deliberately not changed automatically.
	}
	if (next !== source) {
		if (!process.argv.includes('--check')) write(name, next);
		changed++;
	}
}
if (!process.argv.includes('--check'))
	write(
		'branding/reference-inventory.json',
		`${JSON.stringify(
			{
				note: 'Reference classes are file-level review categories; technical identifiers and legal history are retained.',
				files: inventory,
			},
			null,
			2,
		)}\n`,
	);
console.log(JSON.stringify({inventoriedFiles: inventory.length, changed, parserSkipped: skipped}));
