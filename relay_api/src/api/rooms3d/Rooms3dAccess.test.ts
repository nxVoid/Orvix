// SPDX-License-Identifier: AGPL-3.0-or-later
import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {afterAll, beforeAll, describe, it} from 'vitest';

describe('3D rooms authentication and disabled feature', () => {
	let harness: ApiTestHarness;
	let flag: string | undefined;
	beforeAll(async () => {
		flag = process.env.ORVIX_3D_ROOMS_ENABLED;
		delete process.env.ORVIX_3D_ROOMS_ENABLED;
		harness = await createApiTestHarness();
	});
	afterAll(async () => {
		if (flag === undefined) delete process.env.ORVIX_3D_ROOMS_ENABLED;
		else process.env.ORVIX_3D_ROOMS_ENABLED = flag;
		await harness?.shutdown();
	});
	it('requires ordinary authentication', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/channels/1/room3d/join')
			.body({connectionId: 'fake'})
			.expect(401)
			.execute();
	});
	it('rejects joins and settings even for authenticated users when flag is off', async () => {
		const user = await createTestAccount(harness);
		await createBuilder(harness, user.token)
			.post('/channels/1/room3d/join')
			.body({connectionId: 'fake'})
			.expect(403)
			.execute();
		await createBuilder(harness, user.token).put('/channels/1/room3d').body({enabled: true}).expect(403).execute();
		await createBuilder(harness, user.token).get('/rooms3d/capabilities').expect(200).execute();
	});
});
