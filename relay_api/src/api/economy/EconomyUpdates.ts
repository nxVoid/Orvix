// SPDX-License-Identifier: AGPL-3.0-or-later

import {createUserID} from '@app/api/BrandedTypes';
import {Logger} from '@app/api/Logger';
import {getGatewayService} from '@app/api/middleware/ServiceRegistry';

/** Send only an invalidation to the user's own sessions after the transaction commits. */
export function notifyEconomyUpdate(userId: string, inventoryChanged = false): void {
	void Promise.resolve()
		.then(() =>
			getGatewayService().dispatchPresence({
				userId: createUserID(BigInt(userId)),
				event: 'ECONOMY_UPDATE',
				data: {inventory_changed: inventoryChanged},
			}),
		)
		.catch((error: unknown) => {
			Logger.debug(
				{errorName: error instanceof Error ? error.name : 'unknown'},
				'Relay Points update dispatch unavailable',
			);
		});
}
