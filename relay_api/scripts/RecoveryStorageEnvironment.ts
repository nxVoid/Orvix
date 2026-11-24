// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';

export async function loadRecoveryStorageConfig(development: boolean) {
	if (development) {
		const root = path.resolve(import.meta.dirname, '../..');
		const values: Record<string, string> = {};
		for (const file of ['config/env/development.env', 'config/env/local.env', '.env.local']) {
			const name = path.join(root, file);
			if (fs.existsSync(name)) Object.assign(values, parseEnv(fs.readFileSync(name, 'utf8')));
		}
		for (const [key, value] of Object.entries(values)) process.env[key] ??= value;
	}
	return (await import('../src/Config')).Config;
}
