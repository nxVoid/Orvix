// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@relay/constants/src/AdminACLs';
import {afterAll, beforeAll, describe, it} from 'vitest';

describe('Economy API access', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	it('requires authentication before accessing a wallet', async () => {
		await createBuilderWithoutAuth(harness).get('/economy/wallet').expect(401).execute();
	});

	it('denies a normal user and keeps economy admin permissions separate', async () => {
		const user = await createTestAccount(harness);
		await createBuilder(harness, user.token).get('/admin/economy').expect(403).execute();
		await setUserACLs(harness, user, [AdminACLs.AUTHENTICATE, AdminACLs.ECONOMY_READ]);
		await createBuilder(harness, user.token)
			.post('/admin/economy/adjust')
			.body({user_id: user.userId, amount: 25, reason: 'Unauthorized grant', key: 'test-no-mint'})
			.expect(403)
			.execute();
	});
});
