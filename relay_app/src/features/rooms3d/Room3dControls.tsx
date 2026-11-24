// SPDX-License-Identifier: AGPL-3.0-or-later
import {http} from '@app/features/platform/transport/RestTransport';
import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from 'react';

interface Room3dControls {
	channelId: string;
	enabled: boolean;
	open: boolean;
	enter(): void;
	close(): void;
}
const Room3dContext = createContext<Room3dControls | null>(null);
export const useRoom3dControls = () => useContext(Room3dContext);
export function Room3dProvider({
	channelId,
	available = true,
	onEnter,
	onExit,
	children,
}: {
	channelId: string;
	available?: boolean;
	onEnter?: () => void;
	onExit?: () => void;
	children: ReactNode;
}) {
	const [enabled, setEnabled] = useState(false),
		[open, setOpen] = useState(false);
	useEffect(() => {
		setOpen(false);
		setEnabled(false);
		if (!available) return;
		const abort = new AbortController();
		let busy = false;
		const refresh = async () => {
			if (busy || abort.signal.aborted) return;
			busy = true;
			try {
				const r = await http.get<{enabled: boolean}>('/rooms3d/capabilities', {signal: abort.signal});
				if (!abort.signal.aborted) setEnabled(r.body.enabled);
			} catch {
				/* A capability failure must never interrupt ordinary voice. */
			} finally {
				busy = false;
			}
		};
		void refresh();
		const focused = () => {
			void refresh();
		};
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') void refresh();
		}, 15000);
		window.addEventListener('focus', focused);
		return () => {
			abort.abort();
			window.clearInterval(timer);
			window.removeEventListener('focus', focused);
		};
	}, [channelId, available]);
	const controls = useMemo<Room3dControls>(
		() => ({
			channelId,
			enabled: available && enabled,
			open,
			enter: () => {
				if (!available || !enabled) return;
				onEnter?.();
				setOpen(true);
			},
			close: () => {
				setOpen(false);
				onExit?.();
			},
		}),
		[channelId, available, enabled, open, onEnter, onExit],
	);
	return <Room3dContext.Provider value={controls}>{children}</Room3dContext.Provider>;
}
