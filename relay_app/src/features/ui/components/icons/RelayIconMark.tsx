// SPDX-License-Identifier: AGPL-3.0-or-later

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
