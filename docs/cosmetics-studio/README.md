# Relay Cosmetics Studio V2

Open previews/index.html for the art gallery, Quantum Horizon comparison and frame-size review. The gallery uses runtime assets and a bundled default Relay avatar. In-app previews use the signed-in user's actual avatar.

- references/index.html lists the five reviewed PNG boards.
- design-specs/PHASE-0.md records architecture and the file plan.
- design-specs/ART-DIRECTION.md defines material and motion direction.
- source/<id>/ contains masters and authored vector sources.
- assets/<category>/<id>/metadata.json defines a product.
- manifests/collection-v2.json indexes runtime files and hashes.
- QA.md records actual checks and remaining review.

The existing currency is Relay Points (RP). Studio upgrades change artwork on matching starter catalog records. EconomyService retains price, ownership, entitlement and claim authority. Admin-modified asset paths are excluded from automatic upgrades.

## Build and review

Run python3 tools/relay/build-cosmetics-studio.py and python3 tools/relay/build-studio-preview.py from the repository root.

Asset tests use the existing Sharp dependency inside the workspace container. Run docker exec -w /workspaces/orvix orvix-dev-workspace-1 node --test docs/cosmetics-studio/tests/assets.test.mjs.

For local browsing, serve the repository with python3 -m http.server 18755 --bind 127.0.0.1 and open http://localhost:18755/docs/cosmetics-studio/previews/index.html.

## Add a product

1. Assign a permanent ID. Preserve existing IDs on visual revisions.
2. Author a master under source/<id>/ with provenance and license.
3. Create a versioned runtime asset, static poster and preview in the product folder.
4. Include dimensions, motion behavior, protected zones and budgets in metadata.
5. Add the product folder to the manifest and run the validation builder.
6. Review every target size on both backgrounds, with reduced motion and actual profile composition.
7. Set quality_state to reviewed after art and technical review. Candidates are embedded for review and excluded from catalog upgrades.
8. Create its catalog record through the existing admin API. Configure price and Premium policy there.

Animated SVG images embed their raster dependencies. Scripts, event attributes, remote images and external paint URLs are rejected. Playback admits at most two visible cosmetics and falls back when hidden. Coarse-pointer and data-saving devices default to static.

## Entitlement policy

A purchase creates permanent ownership. Items marked premium require the current existing Premium entitlement for use. Expiry preserves inventory and filters active display server-side.

## Next collection

The remaining frames, banners, six profile themes, six nameplates, six effects and six badges from the brief remain planned. Specialized theme and effect rendering needs further profile integration. Voice rewards retain the existing disabled policy until activity can be verified.
