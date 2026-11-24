// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ISearchAdapter} from '@relay/schema/src/contracts/search/SearchAdapterTypes';
import type {SearchableThread, ThreadSearchFilters} from '@relay/schema/src/contracts/search/SearchDocumentTypes';

export interface IThreadSearchService extends ISearchAdapter<ThreadSearchFilters, SearchableThread> {
	ready(): Promise<void>;
}
