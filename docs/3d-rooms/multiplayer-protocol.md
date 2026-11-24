# Multiplayer protocol v1

All paths are relative to the existing versioned API endpoint, with ordinary user authorization. No credentials in URLs. Default-user authentication excludes bots/system accounts. No client user/channel identity fields are accepted in command bodies.

| Method/path | Contract |
|---|---|
| GET `/rooms3d/capabilities` | `{enabled}` from server flag and database compatibility. No schema creation when disabled. |
| GET `/channels/:channel_id/room3d` | Authorized config, avatar choice, `canManage`. |
| PUT same | Strict v1 config, manager permission, audited SQL update. |
| PUT `.../avatar` | `{avatarId}` from approved four-ID catalog; durable user preference. |
| POST `.../join` | `{connectionId}` must match the authenticated user's current gateway-owned voice connection. Returns admission `sessionId` plus initial snapshot. One 3D presence per user per channel. |
| POST `.../move` | `{sessionId,connectionId,sequence,x,z,rotationY,run}`; x/z are input axes, never trusted positions. Strict finite bounds. Target 10 Hz, minimum 60 ms between accepted commands. |
| POST `.../leave` | `{sessionId}`; old tab/session cannot remove its replacement. Does not disconnect voice. |

Bodies are bounded to 1,024 decoded UTF-8 bytes after existing global HTTP/body limits. Control routes are limited to 60/minute; movement 900/minute under existing rate limiting. Server integrates input using its own clock, elapsed time capped at 200 ms, normalized diagonal speed, 3 m/s walk / 5 m/s run, fixed y=0, world boundaries and shared obstacles. Sequence strictly increases. Config capacity is 1–16, ordinary voice-only users do not count.

`RoomSnapshot` contains config, generation UUID, monotonically increasing revision within that generation, server time and at most 16 sanitized avatars. Other admission tokens and expiry timestamps are never exposed. New generations invalidate delayed packets. `ROOM_3D_UPDATE` gateway data is `{channel_id,snapshot}`; the existing Erlang allowlist and frontend registry recognize it. Movement publications coalesce to at most 10 per second per room, with immediate join/leave publication. Fanout targets only the current admitted users; delivery to their other authenticated devices follows the existing own-session gateway mechanism. Transport delivery failures retain HTTP recovery snapshots.

Expired presence can automatically rejoin. A replaced session receives ROOM_SESSION_REPLACED and requires an explicit retry rather than two tabs repeatedly stealing each other's slot. Network failures retry after one second, with no overlapping movement requests or automatic REST retries. Current provider reconnection is observed; no new voice connect call is made. Explicit close sends best-effort leave; abrupt shutdown is recovered by expiry. Gateway kicks/access loss are reflected by the next membership reconciliation. No per-movement SQL persistence or unbounded history.
