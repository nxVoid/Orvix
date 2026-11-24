import {edit, write} from './workspace.mjs';

write(
	'packages/constants/src/BrandingConstants.ts',
	`// SPDX-License-Identifier: AGPL-3.0-or-later

export const PRODUCT_NAME = 'Relay';
const LEGACY_PRODUCT_NAMES = new Set(['orvix', 'fluxer']);

/** Presentation only: never use this function for keys, identifiers or authentication. */
export function productDisplayName(value?: string | null): string {
 const name = value?.trim();
 return !name || LEGACY_PRODUCT_NAMES.has(name.toLowerCase()) ? PRODUCT_NAME : name;
}
`,
);
edit('relay_app/src/features/app/config/ProductConstants.ts', (s) =>
	s.replace(
		"export const PRODUCT_NAME = 'Orvix';",
		"export {PRODUCT_NAME} from '@relay/constants/src/BrandingConstants';",
	),
);
for (const name of [
	'relay_app/src/features/auth/InstanceBranding.ts',
	'relay_app/src/features/app/state/AppShellBranding.ts',
])
	edit(name, (s) => {
		s = s.replace(
			'// SPDX-License-Identifier: AGPL-3.0-or-later',
			"// SPDX-License-Identifier: AGPL-3.0-or-later\n\nimport {productDisplayName} from '@relay/constants/src/BrandingConstants';",
		);
		return s
			.replace(
				'return name == null || name.length === 0 ? null : name;',
				'return name == null || name.length === 0 ? null : productDisplayName(name);',
			)
			.replace('productName: branding.product_name,', 'productName: productDisplayName(branding.product_name),');
	});
for (const name of [
	'relay_app/src/features/app/state/RuntimeDocumentBranding.ts',
	'relay_app/src/features/app/state/ServedDocumentBranding.ts',
])
	edit(name, (s) => {
		s = s.replace(
			'// SPDX-License-Identifier: AGPL-3.0-or-later',
			"// SPDX-License-Identifier: AGPL-3.0-or-later\n\nimport {productDisplayName} from '@relay/constants/src/BrandingConstants';",
		);
		if (name.includes('Runtime'))
			return s.replace(
				'const productName = appPublic.branding.product_name;',
				'const productName = productDisplayName(appPublic.branding.product_name);',
			);
		// Read the served document; old cached documents may still contain a legacy product name.
		return s.replace(/productName: ([^,\n]+),/g, (_, value) => `productName: productDisplayName(${value}),`);
	});
edit('relay_api/src/api/instance/ProductName.ts', (s) =>
	s
		.replace(
			'import {Config}',
			"import {productDisplayName} from '@relay/constants/src/BrandingConstants';\nimport {Config}",
		)
		.replace("const UPSTREAM_PRODUCT_NAME = 'Orvix';", "const UPSTREAM_PRODUCT_NAME = 'Relay';")
		.replace(
			'return Config.instance.branding.productName || UPSTREAM_PRODUCT_NAME;',
			'return productDisplayName(Config.instance.branding.productName);',
		)
		.replace(
			'const productName = cachedProductName ?? getDefaultProductName();',
			'const productName = productDisplayName(cachedProductName ?? getDefaultProductName());',
		)
		.replace(
			"return normalized === '' || normalized === UPSTREAM_PRODUCT_NAME.toLowerCase();",
			"return normalized === '' || normalized === 'orvix' || normalized === 'fluxer';",
		)
		.replace("const UPSTREAM_PRODUCT_NAME = 'Relay';\n", ''),
);
edit('relay_api/src/api/instance/InstanceConfigRepository.ts', (s) =>
	s
		.replace(
			'// SPDX-License-Identifier: AGPL-3.0-or-later',
			"// SPDX-License-Identifier: AGPL-3.0-or-later\n\nimport {productDisplayName} from '@relay/constants/src/BrandingConstants';",
		)
		.replace(
			'product_name: normalizeOptionalString(branding.product_name) ?? defaults.branding.product_name,',
			'product_name: productDisplayName(normalizeOptionalString(branding.product_name) ?? defaults.branding.product_name),',
		),
);
edit('packages/config/src/ConfigLoader.ts', (s) =>
	s.replace(/(product_name|rp_name|client_name): 'Orvix'/g, "$1: 'Relay'"),
);
edit('packages/instance_bootstrap/src/OfficialInstance.ts', (s) =>
	s.replace("OFFICIAL_INSTANCE_NAME = 'Orvix'", "OFFICIAL_INSTANCE_NAME = 'Relay'"),
);
edit('relay_app/index.html', (s) =>
	s
		.replace(/(<title>|content=")Orvix/g, '$1Relay')
		.replace('Orvix is a free', 'Relay is a free')
		.replace(
			'</head>',
			'<meta property="og:site_name" content="Relay">\n<meta property="og:title" content="Relay — Your people. Your place.">\n<meta property="og:image" content="{{STATIC_CDN_ENDPOINT}}/web/relay-social.png">\n<meta name="twitter:card" content="summary_large_image">\n</head>',
		),
);
edit('relay_app/package.json', (s) => s.replace('"description": "Orvix', '"description": "Relay'));
edit('relay_desktop/package.json', (s) =>
	s.replace(
		'"description": "Instant messaging and VoIP application"',
		'"description": "Relay — community, messaging, voice and video communication"',
	),
);
edit('relay_app_proxy/src/branding_images.rs', (s) =>
	s.replace('DEFAULT_PRODUCT_NAME: &str = "Orvix"', 'DEFAULT_PRODUCT_NAME: &str = "Relay"'),
);
edit('relay_desktop/electron-builder.config.cjs', (s) => {
	// Display names and downloads change; bundle IDs, installed directories, signing identities stay stable.
	s = s
		.replace(/(productName|artifactProductName): 'Orvix/g, "$1: 'Relay")
		.replace(/linuxComment: '([^']*)Orvix/g, "linuxComment: '$1Relay");
	s = s.replace(/'Orvix (needs|captures)/g, "'Relay $1").replace('a Orvix instance', 'a Relay instance');
	// The old precompiled asset catalog contains the upstream icon. Use the generated Relay ICNS instead.
	s = s.replace(
		/\s*\.\.\.\(targetPlatform === 'darwin'\s*\? \[\{from: `build_resources\/\$\{iconDir\}\/_compiled\/Assets.car`, to: 'Assets.car'\}\]\s*: \[\]\),/,
		'',
	);
	return s;
});
write(
	'relay_app/src/features/ui/components/icons/RelayIconMark.tsx',
	`// SPDX-License-Identifier: AGPL-3.0-or-later

import RelayMark from '@app/media/images/relay-logo-color.svg?react';
import {msg} from '@lingui/core/macro';
import type React from 'react';
export const APPLICATION_ICON_DESCRIPTOR = msg({
 message: '{productName} application icon',
 comment: 'Accessible label for the Relay application icon.',
});
// Keep this export and its module path compatible with existing callers.
export const RelayIconMark = (props: React.SVGProps<SVGSVGElement>) => (
 <RelayMark role="img" data-flx="ui.icons.orvix-icon.img" {...props} />
);
`,
);
edit('README.md', (s) =>
	s
		.replace(/^# Orvix/m, '# Relay')
		.replace('Orvix is an independently', 'Relay is an independently')
		.replace('Orvix retains', 'Relay retains')
		.replace(
			'See [REBRANDING.md](REBRANDING.md)',
			'See [branding/RELAY.md](branding/RELAY.md) for the Relay branding and compatibility policy. See [REBRANDING.md](REBRANDING.md)',
		),
);
console.log('Applied reviewed display defaults; persistent identifiers untouched.');
