# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 24 or newer.

Install with `pnpm install --frozen-lockfile`. The [validation and release runbook](docs/maintenance.md) is the canonical checklist for docs, site, library, geography, and publication changes.

## Source layout

| Path              | Responsibility                                          |
| ----------------- | ------------------------------------------------------- |
| `src/api.ts`, `src/map.ts`, `src/static.ts` | Data-free exports, controller ownership, static rendering |
| `src/configuration.ts`, `src/controller-types.ts` | Grouped API validation and public controller contracts |
| `src/full-data.ts` | Explicit complete geographic preset (`/data/full`) |
| `src/static-data.ts` | Explicit static geographic preset (`/data/static`) |
| `src/geometry.ts` | Mercator projection and GeoJSON path conversion         |
| `src/district-style.ts`, `src/district-layer.ts`, `src/district-transition.ts` | Prepared district styles, interaction appearance, and cancellable year fades |
| `src/label-renderer.ts`, `src/marker-layer.ts` | Reusable label nodes/metrics and marker visual/entrance ownership |
| `src/marker-catalog.ts`, `src/cluster-renderer.ts` | Prepared marker/picker reconciliation and cluster cache, viewport mounting, listener ownership |
| `src/frame-scheduler.ts` | Shared camera and dependent screen-space render frame |
| `src/data.ts`     | Internal adapter over canonical JSON geometry           |
| `src/types.ts`  | Public TypeScript declarations                          |
| `test/`           | Rendering, XML, projection and input validation         |
| `examples/`       | Reproducible SVG comparison page                        |

Keep runtime dependencies at zero. Library source is strict TypeScript 7. `pnpm build` emits JavaScript, declarations, and imported JSON to `dist/`; package exports point at that build. Do not maintain parallel handwritten declarations. Tests exercise the compiled output; Storybook imports TypeScript source for live reload.

Use `pnpm format` for Biome formatting, import organization, and safe lint fixes; `pnpm check` checks dependency peers, formatting, data, types, and tests. Canonical geographic JSON and generated output are excluded. Biome does not format Markdown or GitHub workflow YAML. Changes to the API need matching declarations and documentation. Geometry changes need dated source records in `SOURCES.md`.

For rendering changes, inspect the example page on desktop and at 390 px. Run `pnpm check` and inspect `pnpm pack` contents before releasing. Never include credentials, node_modules, or source extraction credentials in the repository or archive.

For camera or animation changes, exercise **Checks / Motion lifecycle** in Storybook with normal and reduced motion. Verify interruption, rapid year switches, marker replacement, destruction during callbacks, and font-load invalidation. Label metrics are cached in screen pixels; preserve collision rules and invalidate them when fonts change. District style preparation must finish before mutating state, and reentrant callbacks must not overwrite a newer update.

## Assistant-readable documentation

Run `pnpm docs:llms` after changing package version, documentation, or emitted public type contracts. Commit the regenerated `llms.txt` and `llms-full.txt`; `pnpm check` rejects stale output. The Pages build generates Markdown and text documentation from the same package it uses for maps. Released builds use the installed npm package’s docs and declarations, and adapt examples to its supported API. The Pages browser gate covers delayed and failed geography loading as well as normal pages.

## Public npm releases

Follow the [validation and release runbook](docs/maintenance.md#publish-a-stable-release). GitHub Actions checks Node 24 and 26; stable GitHub releases trigger trusted npm publishing of the validated archive. Normal pushes deploy eligible Pages updates without publishing npm.

The software uses MIT; geographic data retains the terms and attribution recorded in `SOURCES.md`. Keep credentials and unrelated application content out of the repository and archive.

## Interactive examples and dependency updates

Run `pnpm storybook` and update `stories/Map.stories.ts` or `stories/Static.stories.ts` for new public behavior. Keep copyable imports, controls, and interaction checks aligned with the public API. Add stories for new layers or substantial options. Do not reuse a fixed `idPrefix` across stories because Docs renders several maps on one page. Phone stories set the Storybook canvas to 390 px, and the accessibility addon fails Chromium story tests on violations by default. Use a story-level `a11y.test: 'todo'` only with a documented reason for a known issue. Storybook 10 and Vitest run every story as a Chromium rendering check; add a `play` function for behavior that needs interaction coverage. The accessible guide story checks route overlays, overlapping marker selection, and keyboard input. Run `pnpm exec playwright install chromium` once locally before `pnpm test:stories`.

`pnpm test:stories:coverage` writes JSON summary and LCOV reports to `coverage/storybook/`. Coverage includes library code in `src/` and excludes stories, generated files, and geographic JSON. It measures code reached by Storybook browser checks; Node tests still run separately through `pnpm test`. The coverage floor is deliberately below the current browser baseline to catch large regressions without presenting this as complete library coverage. GitHub CI uploads the report as an artifact even if a browser check fails. npm publishing and Pages deployment also require this check to pass.

Visual regression checks compare five Storybook and Pages map states against committed Chromium screenshots. After `pnpm build-storybook` and `pnpm build:pages`, run `pnpm test:visual`. Baselines are specific to macOS, workspace Linux, and GitHub Actions Linux because system fonts differ. GitHub expectations have a `linux-github` suffix. Refresh each environment's images in that environment; never replace CI expectations with workspace captures. Review changed screenshots before running `pnpm test:visual --update-snapshots`; CI keeps failed screenshots and traces as a `visual-differences` artifact. The Pages deployment also requires the Linux visual checks to pass.

After `pnpm build:pages`, run `pnpm test:studio` to check delayed and failed data loading in the layers studio, including rendering selection and download controls.

Run `pnpm exec playwright install --with-deps chromium firefox webkit`, then `pnpm test:browsers` for the focused production-bundle interaction suite at 1440 px and 390 px. It checks 2,000-marker viewport culling, retained nodes, offscreen focus, and coincident selection, SVG keyboard focus, marker reconciliation, camera input, resize projection, touch-mode scroll policy, reduced motion, and disposal. Phone widths are desktop-engine layout checks, not physical-device gesture tests. This suite supplements the full Chromium Storybook and visual gates.

Run `pnpm benchmark:markers` for deterministic 500- and 2,000-marker workloads at 800 px and 390 px. To compare engines, use `pnpm benchmark:markers --browsers=chromium,firefox,webkit`. Use `--mode=neighborhoods` to exercise neighborhood label preparation as well as marker-heavy basemap rendering. Run it alone on an otherwise idle machine; browser suites and benchmarks share the generated fixture and port. The benchmark writes environment information, browser versions, and p50/p95/max timings, six clustered/unclustered frame scenarios, and untimed pin-allocation probes to `test-results/marker-benchmark.json`. See the [README](README.md#browser-checks-and-marker-performance) for methodology and measured results. CI records a shorter Chromium run without hardware-dependent timing thresholds.

The **Checks / 2000 markers** desktop and phone stories exercise zoom, pan, clustering, retained-ID updates, and offscreen selection. They display mounted pin/cluster counts alongside the complete catalog. The lazy-marker browser check counts pin allocations, exercises first selection and focus recovery, and checks updated styles on first visibility. **Checks / Motion lifecycle / Lazy Marker Entrances** checks first visibility, reentry, and cancellation. The benchmark also records counts at overview and two zoom levels, with clustering enabled and disabled. See the [implementation plan](docs/marker-performance-plan.md) for the rendering contract.

Optional Bun compatibility: install the version pinned in `.bun-version` (currently 1.4.3), then run `pnpm test:bun`. This checks compiled ESM/JSON imports and static rendering; browser interaction checks remain in Playwright. TypeScript 7.0.2 is the current stable compiler, and packed-package smoke tests compile strict consumers against generated declarations.

Dependabot proposes weekly npm and GitHub Actions updates, grouping Storybook, Vitest, and GitHub Actions updates by family. Keep Storybook packages on matching versions; `pnpm check` rejects peer conflicts. `pnpm-workspace.yaml` narrowly widens the Storybook 10.6.0 Vitest addon's Vitest and browser peer ranges for the tested Vitest 5 setup. Remove those overrides when Storybook publishes matching ranges. The weekly maintenance workflow also checks peers and runs `pnpm audit --audit-level high`; run `pnpm outdated` to review available updates. React, Vitest, and Playwright are development dependencies for Storybook testing; the published package must retain zero runtime dependencies.

## Renderer and geographic data structure

- `data/*.json`: canonical GeoJSON, source definitions, names, aliases, and rendering anchors; no duplicate geometry in JavaScript.
- `pnpm data:check` validates the GeoJSON collections and generated guide geometry before the typed JSON import adapters are trusted. Keep these validators in `scripts/`; they are build-time checks and must not enter browser bundles.
- `data/index.ts` and `data/types.ts`: immutable data helpers and typed name lookup, separate from the map renderer.
- `src/layers.ts`: small layer renderers; drawing order remains explicit in `src/map-core.ts`.
- `src/svg.ts`: shared XML escaping, numeric formatting, and stroke attributes.
- `scripts/build-data-catalog.mjs`: deterministic metadata-only catalog generator. Run `pnpm data:catalog`; `pnpm check` rejects a stale catalog.
- `stories/NeighborhoodData.stories.ts`: source-aware neighborhood lookup and projection example.

Read `data/README.md` before changing schemas or names. Keep canonical names scoped to their definition source, preserve source labels, and cite alias evidence. New geometry requires a source record. Do not merge same-name polygons from different source collections. Tests include pre-migration geometry digests to catch accidental loss of district display extras.

## Pages release previews

`pnpm build:pages` builds an offline local preview from the current compiled package and labels it as a local preview. `pnpm build:pages --released` installs npm’s current stable version into a temporary directory, bundles its browser components, and generates its SVG downloads. It requires registry access; the deployed site needs no runtime CDN or registry requests. `pages-dist/release.json` records the version and source.

The site in `website/` shares one design system (`site.css`, with motion tokens, view transitions, and reduced-motion and print rules). The build injects the masthead and colophon at `<!--site-header-->` and `<!--site-footer-->`, marking the current section. It also writes, with the library itself:

- `data/site-map.json`: `fullMapData` with every geometry simplified for display by `scripts/site-data.mjs`, loaded by the atlas, layers studio and spot pages;
- `maps/display/` and `maps/thumb/`: district maps and thumbnails (with dark twins) simplified by `scripts/simplify-svg.mjs`, used by the example pages;
- `maps/plates/` and `maps/figures/`: animated plates from `renderMap({ animation })` and docs figures, each with a dark twin.

Canonical data in `data/` and the full-precision SVGs in `maps/` stay unchanged. Pages built with `--released` use the published package, so a site feature that needs an unreleased library feature must degrade gracefully until the next release. After `pnpm build:pages`, run `pnpm test:pages` to check every page in Chromium for script errors, failed requests, sideways scrolling, layout shift, and compressed size budgets; CI runs it before each deploy. For visual changes, still inspect pages at desktop and 390 px in both themes.

Pages deploys on `main` updates and after a successful npm publishing workflow. Release-triggered builds wait up to five minutes for npm to expose the exact published version. If processing takes longer, rerun the failed Pages workflow.
