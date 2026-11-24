# Studio V2 quality review

## Phase status

| Phase | Outcome |
| --- | --- |
| 0 — discovery | Five PNG boards opened individually. Existing SVG, RP ledger, premium authority, equip slots and profile surfaces examined. File plan recorded. |
| 1 — design system | Local neutral studio tokens, inherited typography, quieter cards, rarity filter, price ordering and live profile composition implemented in EconomyTab. |
| 2 — first art set | Quantum Horizon, Violet Halo and Midnight Orbit reviewed for this iteration. Amethyst Crown is a blocked candidate. |
| 3 — playback foundation | Shared two-animation budget, viewport and tab visibility, reduced-motion fallback and static coarse-pointer/data-saving policy implemented. |
| 4–7 | Existing commerce API reused. Full collection, specialized theme/effect slots and cross-browser product QA remain further work. |

## Asset review

| Product | Result | Remaining review |
| --- | --- | --- |
| Quantum Horizon | Independent generated landscape and alpha mist. Runtime poster is 1440×480 WebP. Runtime SVG provides restrained 24-second independent haze movement. Old and new versions are side by side in the gallery. | Long-running loop and Firefox/Android visual review |
| Violet Halo | Original satin-metal vector and partial traveling highlight. Transparent center at all five target sizes. | Final material/art signoff |
| Midnight Orbit | Restrained orbital support and slow satellite movement. Transparent center at all five target sizes. | Final motion/art signoff |
| Amethyst Crown | More detailed generated amethyst/metal material retained as a candidate. Face protection cuts upper stone mounts. 32-pixel resampling introduces nonzero alpha into the protected inner region. | Geometry revision required. Excluded from automatic catalog upgrades. Existing catalog art continues to work. |

## Executed checks

- 16 focused Vitest tests passed. This includes existing PostgreSQL purchase, claim and access regressions plus two animation admission/cancellation tests and a static/animated shared-banner-slot regression.
- 21 asset tests passed. These check product identities, file budgets, fallback files, frame center transparency at 32/40/64/96/128 pixels, WCAG AA text contrast and rejection of the unreviewed crown candidate. The crown's 32-pixel check expects rejection and does not certify its quality.
- API and web TypeScript checks passed during this iteration.
- The actual versioned Quantum Horizon API asset returned HTTP 200 with image/svg+xml.
- The generated review gallery was opened in Windows headless Chrome at 1280×1100 and 390×844. No horizontal overflow, missing images or runtime errors were reported.
- Reduced-motion emulation retained the WebP poster.
- In the gallery with one animated banner, 120 requestAnimationFrame samples had a 95th-percentile interval of approximately 7.2 ms. JavaScript heap used was 847,560 bytes with 460 DOM nodes. These are review-gallery measurements on this machine.
- Screenshots are previews/relay-studio-desktop.png and previews/relay-studio-mobile.png. Raw browser measurements are tests/browser-review.json.

## Verification limits

GPU allocation and total process RAM were not measured. The frame timing and JavaScript heap values do not certify GPU or mobile battery behavior. Actual signed-in app browser screenshots, Firefox playback, native device behavior and a complete 24-second visual loop inspection remain open.

Reference review uses a bundled default Relay avatar. The in-app component uses the current user's actual avatar and combines the candidate with equipped frame, banner and nameplate data. The gallery exercises art and sizing independently of account authentication.

Studio upgrades preserve product IDs and update asset paths only when the starter catalog still points at the original art. Administrative asset edits, balances, transaction receipts and ownership are preserved.

The development catalog now uses the three reviewed V2 assets. Amethyst Crown still points at its original catalog asset.
