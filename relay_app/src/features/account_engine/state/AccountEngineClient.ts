// SPDX-License-Identifier: AGPL-3.0-or-later

import {getElectronAPI} from '@app/features/ui/utils/NativeUtils';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';
import {AccountEngineErrorCode, type AccountEngineRendererAPI} from '@relay/desktop_ipc/src/AccountEngineContract';
import {isObjectLike} from '@relay/record_utils/src/RecordGuards';

const ACCOUNT_ENGINE_ERROR_CODES = Object.values(AccountEngineErrorCode);
const TOKEN_TAG_HEX_LENGTH = 32;

export function resolveAccountEngineApi(): AccountEngineRendererAPI | null {
	const api = getElectronAPI()?.accountEngine ?? null;
	return api?.isAvailable === true ? api : null;
}

export function readAccountEngineErrorCode(error: unknown): AccountEngineErrorCode | null {
	if (!isObjectLike(error)) {
		return null;
	}
	const code = error.code;
	if (typeof code !== 'string') return null;
	return ACCOUNT_ENGINE_ERROR_CODES.find((candidate) => candidate === code) ?? null;
}

export function accountEngineTokenTag(token: string): string {
	return bytesToHex(sha256(utf8ToBytes(token))).slice(0, TOKEN_TAG_HEX_LENGTH);
}
