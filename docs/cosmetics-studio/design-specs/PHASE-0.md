# Relay Cosmetics Studio V2 — discovery

## Existing implementation

Relay already has a PostgreSQL adjunct economy behind its Cassandra-compatible KV repositories. EconomyService owns wallet locks, ledger receipts, purchases, inventory and per-category equip slots. User.isPremium() remains the entitlement authority. Cosmetics are returned on authorized profile responses and a bounded public projection supplies avatar and message decoration. The web and desktop share EconomyTab. Flutter has a separate Relay Points page.

The currency is Relay Points (RP). Keep its existing wallets, prices, ownership and claim receipts. No currency rename or parallel balance is needed. Existing voice missions are disabled until activity can be verified. This visual iteration does not enable them.

Existing art is embedded by tools/relay/generate-economy-assets.py. EconomyController serves audited SVG strings and normalized uploaded WebP. A studio manifest can extend that pipeline with versioned assets while preserving product IDs and ownership. Starter prices and premium flags stay under existing catalog administration.

The shared app already supplies typography and theme tokens such as --background-primary, --background-secondary, --text-primary and --text-primary-muted. Studio surfaces get local semantic tokens. Global themes stay under the existing theme subsystem.

## PNG review

All five PNGs in docs/references/spark were opened individually.

| File | Retain | Adapt |
| --- | --- | --- |
| Relay Avatar Frame Collection-2.png | Distinct crystal, orbital and glass material identities | Narrow the luminous rim and protect the face aperture at 32 px |
| Neon Purple Cosmic Banner Collection-3.png | Layered landscape and wide compositions | Reduce bright violet coverage, preserve a quiet avatar zone, avoid the wire-grid landscape |
| Neon Sci-Fi Profile Collection-4.png | Large product imagery and identifiable product families | Replace thick glowing card edges and repeated rating ornament with clear ownership and price |
| Relay Kozmetik Ekonomisi Tasarım Panosu.png | Discovery, category navigation, mission access and live profile preview | Keep RP and actual PostgreSQL architecture, use measured contrast and fewer simultaneous panels |
| Relay Neon Cosmetics UI Board-1.png | Material palette and categories | Treat the board as art direction rather than a page layout |

## Quantum Horizon audit

The existing 960×320 SVG is 6,989 bytes. Its sky contains 40 regularly stepped circle positions, repeated opacity values and one oversized halo. The terrain is one quadratic path with one bright contour. There is no physical light falloff, foreground/midground separation or localized atmospheric event. Its animation moves a highlight rather than a scene. It cannot support a cinematic landscape through minor adjustments.

The original remains in references. A new independently generated raster landscape will supply natural terrain detail. A restrained, independently controlled fog/light layer will provide a slow seamless animation. The text and avatar overlap region stays quiet.

## File-based plan

1. design-specs/ART-DIRECTION.md defines the first four products, framing, material, motion and safe zones.
2. source/<id>/ stores authored SVG or generated raster masters and provenance. assets/<category>/<id>/ stores runtime assets, fallback and metadata.
3. manifests/collection-v2.json maps existing product IDs to versioned render assets, sizes and budgets.
4. tools/relay/build-cosmetics-studio.py validates package paths, SVG safety, alpha aperture and budgets, then generates an API asset registry.
5. CosmeticAssets.tsx supplies controlled artwork playback with visibility, reduced motion and limited concurrency.
6. EconomyTab adds quieter discovery surfaces, rarity filtering, price sort and live profile presentation around the existing purchase and equip commands.
7. previews/index.html presents reference review, side-by-side Quantum Horizon comparison and frame tests at 32/40/64/96/128 px.
8. tests/ and QA.md record actual validations and open browser or GPU measurements.

## Scope gates

The first quality set is Quantum Horizon, Violet Halo, Amethyst Crown and Midnight Orbit. The remaining collection names are a planned backlog until assets meet the same checks. GPU and RAM claims require runtime measurements. Device and browser checks are reported by actual execution.
