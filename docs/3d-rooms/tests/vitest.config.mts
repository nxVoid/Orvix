// SPDX-License-Identifier: AGPL-3.0-or-later
export default {
	root: new URL('../../../relay_app', import.meta.url).pathname,
	resolve: {tsconfigPaths: true},
	test: {include: ['../docs/3d-rooms/tests/*.test.ts'], environment: 'node', maxWorkers: 1},
};
