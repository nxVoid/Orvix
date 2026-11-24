# Security review

- Server flag and ordinary authentication gate every 3D endpoint; bot/system access rejected. Feature off creates no room schema or session.
- Existing channel authorization checks privacy; guild CONNECT is required. Settings additionally require MANAGE_CHANNELS; DM settings require existing ownership. No arbitrary roles or alternate identity service.
- Gateway voice connection identity is checked every exchange. User ID comes from authenticated context; channel ID comes from authorized route. Client coordinates are never accepted as authoritative positions.
- Capacity and session mutation are serialized under a PostgreSQL transaction advisory lock shared across API instances. It is not a cache lease which can expire mid-write. Native concurrent SQL test verifies 16 admissions from a 20-way race.
- Finite numeric fields, strict schemas, approved asset enum, bounded decoded body, sequence checks, axis normalization, server time and speed/geometry limits. Default rate limits 900 movement and 60 control operations/minute. Cached room state max 16 avatars; no unbounded listener or movement history.
- Snapshots strip admission tokens and target only admitted users through own-session gateway dispatch. Client delivery validates snapshot size/shape and channel listeners; generation/revision reject stale state. Unknown event ignored by old clients.
- Revoked/kicked voice membership is pruned on the next request; empty inactive state expires. Abrupt clients expire in five seconds on next reconciliation, full cache expires in ten seconds. Inactive SQL channel config has no ability to grant access.
- Two approved bundled GLBs with pinned sources, hashes and CC0/CC-BY attribution; no user asset URLs/uploads or scripts. Static local asset policy needs no new network CSP permission.
- Settings and actor IDs are audited; no voice/video frames, movement history, passwords or session tokens logged.

## Operational limits

Native PostgreSQL and shared cache are required; this version deliberately advertises disabled on other database backends. Cache access is performed while holding the SQL advisory lock, so cache/PG availability is a 3D dependency; voice remains independent. Lock acquisition times out after 1.5 seconds. This is bounded for the initial target, not proven fleet-scale room throughput. Orphan config maintenance and retention policy for the settings audit require operator decisions; no destructive cleanup is automatic. Do not roll out before real Windows client and multi-device media regression gates pass.
