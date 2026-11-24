// SPDX-License-Identifier: AGPL-3.0-or-later

import {spawnSync} from 'node:child_process';
import path from 'node:path';

const binary = process.env.ORVIX_CI_BIN?.trim();
const args = process.argv.slice(2);
if (args[0] === 'build-desktop-native-addon' && !process.env.CARGO_TARGET_DIR) {
	process.env.CARGO_TARGET_DIR = process.env.ORVIX_NATIVE_TARGET_DIR ||
		path.resolve(import.meta.dirname, '../../target/native-addons');
}
const result = spawnSync(binary || 'cargo', binary ? args : [
	'run', '--locked', '--quiet', '--manifest-path', path.join(import.meta.dirname, 'Cargo.toml'), '--', ...args,
], {stdio: 'inherit', env: process.env});
if (result.error) {
	console.error(result.error.message);
}
process.exit(result.status ?? 1);
