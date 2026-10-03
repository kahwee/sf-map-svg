# Changelog

User-visible changes are recorded here. Unreleased entries describe changes on `main` that are not part of a tagged package release.

## Unreleased

## 4.3.0 — 2026-10-02

- Add `selectFeature` with typed marker, neighborhood source/ID and district year/ID references. Missing or mismatched identities preserve current geography and selection.
- Accept the same source-aware map data in static and interactive rendering. Static maps can explicitly select a supplied neighborhood definition without manually rebuilding renderer rows; compact static inputs remain supported.
- Include current mode, source, year and labels in configuration snapshots. Route controller mode/source/label setters through atomic configuration and support explicit camera preservation with `{ resetView: false }`.
- Refine the Pages atlas opening with concise copy, a map ahead of statistics on phones, coordinate captions and three direct paths into designing, exploring and building. Improve shared theme-button touch targets and stack API reference records on phones while retaining table semantics.

- Clarify the documentation paths, progressive enhancement and cleanup examples; consolidate browser validation and release instructions into one maintenance runbook. Check README and integration recipes against the packed package.

## 4.2.0 — 2026-10-01

- Reuse one native dropdown treatment across Pages, with an inset chevron, a reserved end gutter, and preserved labels, keyboard behavior, and mobile pickers.
- Strengthen the playground with strict TypeScript, checked JavaScript/TypeScript snippets, versioned design links, persistent explicit layer choices and independent static rendering. Keep mobile controls unobstructed and picker labels legible in dark mode.
- Express explicit configuration resets for consumers using `exactOptionalPropertyTypes`, including nested appearance tokens. Make Pages API and guide references describe their actual package version without internal preview warnings.

- Share grouped `layers` and supported `appearance` options between static and interactive maps, retaining flat static options and existing defaults; accept readonly static marker arrays.
- Update interactive appearance, mode, source, district year and labels through `configure`, preserving camera and retained marker nodes. Merge appearance tokens by key and validate combined patches before commit.
- Add `getResolvedConfiguration()` and `getCapabilities()` for effective layer switches and supplied geography, plus an additive `selectionchange` event with consistent current/previous snapshots.
- Add a live Pages map design playground with six editable palettes, layers, typography, sample pins/routes, browser/static previews, undo/redo, shareable designs, copyable code and full-city SVG export. Keep released-package previews compatible with their installed API.
- Refresh the Pages site: a new SF Map SVG mark traced from the real coastline, a reframed header with a release link, card-style reference tables that no longer collapse, a live filter for the API reference, an aligned playground with one-row-per-colour inks, and 12px minimum type for labels and badges.

## 4.1.0 — 2026-10-01

- Validate canonical and generated GeoJSON during data checks, rejecting invalid WGS84 coordinates and malformed polygon rings before release.

- Reject nonnumeric or nonfinite custom district IDs before they enter SVG markup or animation CSS; fall back to the primary district label when `labelPoints` is empty.
- Stop district activation and keyboard focus after selection callbacks destroy the map or replace the selection; share pointer and keyboard activation guards.
- Keep layers studio controls safe while data loads, honor the chosen rendering mode, and report failed loading without a second error. Narrow the older-release feature fallback to its supported compatibility cases.

- Preserve existing HTML entities in generated social titles instead of double-escaping them.

- Gate studio interactions until geography loads, keep failed loads safe, disable controls unsupported by static maps or the selected release, and label preview-only APIs on released documentation pages.
- Make the camera ownership browser check independent of a short animation timing window; clarify that marker-change events report selection rather than every activation.

- Make misplaced interactive-option errors name the supported appearance, feature, or event API.

- Clarify developer integration defaults, runtime configuration and lifecycle; generate version-aware llms.txt, complete text docs, Markdown guides and TypeScript contracts for npm and Pages.

- Fix layers studio copied examples to preserve the selected mode, layers, motion durations, and supported release features; execute generated examples in the regression checks.

- Add opt-in `animation` for `renderMap`: a self-contained, scoped CSS draw-in (coast and lines draw, districts grow, labels and points follow) that plays inline or as an image and respects reduced motion. Default output is unchanged.
- Add `features.layerTransitions`: layer switches fade, `setSource()` crossfades neighborhood definitions, and `setDistrictStyle()` crossfades district fills.
- Add `features.districtMorph`: district outlines morph between map years on `setDistrictYear()`, settling on the exact geometry; `{ animate: false }` stays instant.
- Pages site: a classic, editorial redesign with an animated atlas home, a scroll-driven tour of the controller, a layers studio for every layer and neighborhood definition, rebuilt local measures, California propositions and supervisorial votes examples, and new documentation and API reference pages. Example pages now load prebuilt display maps and a display-simplified dataset instead of raw geometry.

## 4.0.1 — 2026-09-28

- Reconcile marker updates by ID, preserving retained SVG nodes, picker options, keyboard focus, and entrance animations. Identical ordered updates no longer mutate the DOM; only new IDs animate in and removed markers cancel their entrances.
- Advance animated cameras and dependent label, marker, and cluster layout in one shared browser frame, with regression coverage for coalescing, cancellation, reentrant updates, and destruction.

## 4.0.0 — 2026-09-28

- Breaking: require Node 24 or newer for server rendering and development. Validate the minimum supported major alongside Node 26 in CI; browser runtime requirements are unchanged.
- No map API, geographic data, rendering, or animation changes. Existing v3 integrations only need a supported Node runtime to upgrade.

## 3.1.0 — 2026-09-28

- Add `createGuideController` and `mountGuideController` with the grouped options, camera, subscriptions, and lifecycle of `createMap`; preserve existing element-based guide factories.
- Reject invalid marker coordinates before static rendering invokes district-style callbacks.
- Prepare district styles once per update before changing the map, and reuse projected district paths.
- Track both district crossfades so interrupted transitions, reduced motion, and teardown remove all outgoing layers.
- Reuse label nodes and screen-space text measurements during camera movement, refreshing metrics when fonts load; separate label rendering and district appearance from the interactive engine.
- Give marker visuals and entrance animations their own lifecycle, and prevent reentrant district callbacks from overwriting newer state or restarting work after destruction.
- Document guide-controller integration and district-style refresh semantics; add browser regressions for callback atomicity, interrupted fades, camera motion, marker replacement, label reuse, and progressive shell mounting.

## 3.0.1 — 2026-09-27

- Narrow the complete-data presets to their direct geographic modules without changing rendered SVGs or public API behavior.
- Correct stale contributing and example documentation links, add a local Markdown link check to `pnpm check`, and show the v3 controller API on the Pages homepage.
- Skip the early push-triggered Pages build while a new package version is still processing on npm; the successful release workflow deploys that version from the registry.
- Serve local visual snapshots with the same streaming Node HTTP approach as the Pages browser check, avoiding intermittent resets while loading large optional map data.

## 3.0.0 — 2026-09-27

Version 3 removes the deprecated compatibility APIs. Applications must migrate before upgrading. The data-free root API introduced in version 2 remains the supported API.

### Breaking changes

- Remove the `/legacy`, `/custom-map`, `/explorer`, `/interactive`, and `/interactive-data` package entry points and their bundled-data factories. These imports fail to resolve in v3; they are removed, not merely marked deprecated.
- Replace `renderSFMap(options)` with `renderMap(fullMapData.map, options).svg`, `createSFMap(options)` with `renderMap(fullMapData.map, options)`, and `createSFMapWithData(options, data)` with `renderMap(data, options)`.
- Replace `createNeighborhoodExplorer(options)` and `createInteractiveSFMap(options)` with `createMap(fullMapData, options)`; mount the returned controller's `.element` and call `.destroy()` on unmount. Replace `createInteractiveSFMapWithData(data, options)` with `createMap(data, options)`.
- Import complete packaged geography explicitly from `/data/full`, or compose smaller data from `/data/*`. The root import continues to bundle no geography. Existing `/guide` and `/transit` entries remain available.

### Migration and verification

- Add a [v3 migration guide](docs/migration-v3.md) with import and method mappings. Update README, runnable examples, Storybook, Pages generation, TypeScript contracts, and packed-consumer checks to use the supported API.
- Preserve the generated SVG output for the old complete-data preset while making that data an explicit import. Keep the guide's narrow overview and detailed-data loading.
- Add `/data/static` for the complete static map without interactive lookup collections; use it on the Pages spot explorer so its detailed coast and labels retain their reviewed appearance without pulling in unused collections.

## 2.2.0 — 2026-09-27

- Add “One spot, three San Franciscos” to Pages and Storybook, comparing the same location across district, neighborhood, and transit views.
- Modernize the Storybook examples in TypeScript and gate map changes with reviewed desktop and 390 px visual snapshots on macOS and Linux.
- Add first-class election choropleths: static and interactive `districtStyle`, live district year/style setters, district selection and activation events, keyboard interaction, and a reduced-motion-aware year crossfade.
- Export `getLayerPaths` for canonical fitted layer geometry and `DistrictYear`, `DistrictRowData`, and `DistrictStyle` from the modern entrypoints.
- Add an official-election Storybook example covering three boundary years, vote-share coloring, mobile layout, keyboard selection, year changes, and accessibility checks.

## 2.1.0 — 2026-09-27

- Pages site: add motion and a dark theme. Cross-document View Transitions keep the header still and morph example titles into page titles; the home hero is an interactive dot map of the 2022 districts; entrances, count-ups, growing charts, and hover/focus micro-interactions respect reduced motion and print. The site adds no library.
- Pages site: load simplified display maps and thumbnails instead of full-precision SVGs and bundled GeoJSON (candidate and proposition explorers drop from about 391 KB to 12 KB of compressed JavaScript and CSS); add dark map thumbnails, a favicon, a 404 page, a sitemap, per-page social tags, theme-colored browser bars, and a browser smoke test with size budgets that gates deployment.
- Add six optional San Francisco candidate vote snapshots (2016–2026), a Pages explorer, official source records, and a dataset import script.

## 2.0.0 — 2026-09-27

Version 2 makes geography an explicit dependency and separates the application API
from its DOM element. This keeps small consumers small, gives configuration one
consistent home, and makes animation and subscription ownership predictable.

**Migration:** [Complete v1 → v2 guide, with before/after examples](https://github.com/kahwee/sf-map-svg/blob/v2.0.0/docs/migration-v2.md).
**API:** [README](https://github.com/kahwee/sf-map-svg/blob/v2.0.0/README.md).
**Consumer performance:** [Integration guide](https://github.com/kahwee/sf-map-svg/blob/v2.0.0/docs/consumer-integration.md).

### Breaking changes

- The root export now provides data-free `createMap(data, options)` and `renderMap(data, options)`. Move old `createSFMap`, `renderSFMap`, `neighborhoodNames`, `districtColors`, `districtYears`, and legacy static type imports to `/legacy` for an incremental migration. Existing named subpaths retain their compatibility APIs.
- `createMap` returns a controller: mount `map.element`. Features belong in `features`, styling in `appearance`; flat spellings are rejected. Use `configure({ features, layers, controls })`, `camera.*`, and typed `on()` subscriptions. Appearance is construction-only.
- The controller throws on operations after disposal; `destroy()` and unsubscribe remain idempotent. Configuration rejects unknown/malformed keys and invalid ranges. Marker/overlay IDs must be unique. Shared guide geography is immutable; clone before deriving custom data.

### Added

- Data-free `/map` and `/static` entrypoints, configuration-only `/presets`, detached configuration snapshots, and all-groups validation before configuration updates. Camera pan, zoom, reset, fit and set accept consistent animation options.
- Palette, label font/weight/halo, selected/hover neighborhood styling, custom legend entries, compact expandable attribution, and independent visible/accessibility touch labels.
- Opt-in eased camera motion and staggered marker entrances, respecting reduced motion, interruption, preference changes, and disposal.
- Per-pin radii, selected rings, deterministic screen-space clustering and accessible marker choice, HTML overlay placement, screen projection, north arrow and approximate scale bar.
- Server-safe overview `createGuideSVG` / `createGuideShell` and compact `mountGuideMap`, using matching simplified geography and reserved layout rows.
- Coastline-only basemaps without neighborhood datasets. SFAR remains the default when supplied; alternative-only data selects the available source.
- Full migration documentation, public examples, adversarial API contract matrix, production import-graph/size budgets, and automatic verification that GitHub release notes contain the complete changelog. The npm archive now includes CHANGELOG.md.

### Fixed and hardened

- Reentrant camera and selection callbacks cannot revive obsolete animation or overwrite a newer selection. Failed source, marker, overlay, feature, layer and control updates preserve existing state.
- Runtime controls remain independent, feature toggles preserve camera/selection, and unrelated configuration updates no longer interrupt motion. Hiding touch controls returns gestures to the page.
- Revoke obsolete cluster handlers immediately when markers, selection or clustering settings change; v2 overlay activation is wired to typed events for mouse and keyboard users.
- Keyboard focus remains reachable through filtering and clustering; removed overlays lose listeners. Construction failures and repeated destruction clean up observers, listeners and asynchronous work.
- Detached selection/event snapshots prevent accidental mutation of renderer state. Malformed/sparse viewports, coordinates, padding, overlay geometry and misspelled options are rejected. Corrected public `LineString` overlay typing.
- Root static imports tree-shake away browser code and all geographic JSON. Renderer, camera, clustering, configuration and validation have separate internal boundaries; rendering remains offline with zero runtime dependencies.

### Validation and bundle guidance

- Covered by Node regression tests, Chromium Storybook interactions/coverage, declaration tests, clean packed-consumer installation, and desktop/390px browser inspection. Required checks include demo, Storybook and Pages builds.
- Representative production gzip measurements: v2 root **22.8 KiB without geography**; static-only root import **4.5 KiB**; compatibility guide including overview geography **110.2 KiB**. Consumer output varies. Runtime switches do not remove imported code or data; use narrow entrypoints, explicit datasets and lazy detail loading.

## 1.5.2 — 2026-09-26

- Run every Storybook story as a Chromium/Vitest browser check and publish an LCOV and JSON coverage artifact for the renderer, with baseline regression thresholds.
- Require the browser and coverage check before npm publishing or Pages deployment.

## 1.5.1 — 2026-09-26

- Run focused Storybook 10 browser interactions and accessibility checks in CI and before npm publishing, covering overlapping markers, route overlays, and keyboard selection.
- Validate certified proposition district sums against city totals in the data test suite.
- Keep Biome and the development dependency set current after an audit and outdated-package review.

## 1.5.0 — 2026-09-26

- Add `controls.neighborhoodPicker`, `controls.markerPicker`, `controls.help`, and `controls.status` so compact embeds can drop redundant chrome. Hidden help remains the map's accessible description; a hidden status line remains a polite live region; source attribution stays visible.
- Keep a configured `strings.chooseMarker` label after `setMarkers()` updates instead of reverting to “Choose marker”.

## 1.4.1 — 2026-09-26

- Add a task-based example gallery and code recipes, with clearer routes among the Pages atlas, local measures, district history, transit, and lightweight map.
- Add a California proposition explorer using certified November 2024 Yes and No votes for all eleven San Francisco supervisorial districts; publish its sourced JSON and reproducible import script.

## 1.4.0 — 2026-09-26

- Split geographic convenience exports into independent data modules, so metadata search and SFAR-only lookup avoid unrelated JSON.
- Separate the guide's detailed loader from overview geography; keep the existing `/guide` exports and add explicit `/guide/detailed`, `/guide/data`, and `/guide/map` paths.
- Make the optional transit animation include only its 2022 map geography, preserving the rendered route while cutting its consumer bundle size.
- Publish a before-and-after tree-shaking report for representative consumer imports.

## 1.3.8 — 2026-09-26

- Give the district map a clear, dedicated viewing area on mobile by shrinking the election and measure controls and moving the map legend below the map.
- Replace the oversized mobile focus button with a compact icon while keeping its accessible name and a 44px touch target.

## 1.3.7 — 2026-09-26

- Expand the GitHub Pages measure explorer to 44 local measures across November 2002, November 2012, November 2022, and June 2026, covering all three supported district map years.
- Keep election results and district maps in separate, on-demand JSON chunks; add a searchable measure list, election picker, shareable year-specific views, and dated exports.
- Reconcile historical district vote totals to official citywide results and document source checksums and the 2012 precinct-to-district grouping method.

## 1.3.6 — 2026-09-26

- Simplify district history playback to one JavaScript morph implementation, removing the larger CSS animation and fallback branch while preserving the moving boundaries and reduced-motion switch.

## 1.3.5 — 2026-09-26

- Animate district boundary morphs with CSS path transitions and coordinated CSS fades on supported browsers, retaining a JavaScript fallback and reduced-motion instant switch.

## 1.3.4 — 2026-09-26

- Morph matched district outlines between historical maps on GitHub Pages, restoring moving boundaries in place of the 1.3.3 line trace.
- Keep each dated SVG exact when motion settles and switch instantly for visitors who request reduced motion.

## 1.3.3 — 2026-09-26

- Draw each historical district map’s actual boundary lines during the GitHub Pages playback, with a reduced-motion instant switch.

## 1.3.2 — 2026-09-26

- Rebuild GitHub Pages as a civic atlas led by interactive June 2026 ballot measure results, with district selection and clear citywide outcomes.
- Showcase 2002, 2012, and 2022 district maps together and add a controllable boundary reveal that respects reduced-motion settings.
- Bring the schematic BART journey into the homepage with one-click playback and keep the guide map available on demand.

## 1.3.1 — 2026-09-26

- Rework the GitHub Pages homepage around the lightweight guide map and show the released bundle-size comparison.
- Load the full neighborhood explorer and schematic BART demo only when visitors request them, keeping unused geography out of the initial page load.

## 1.3.0 — 2026-09-26

- Add a lightweight guide map preset with subpixel overview geography, lazy detailed datasets, curated highways and streets, independent road labels, and smaller consumer bundle size.
- Curate six guide streets and prioritize their visibility by zoom while preserving road geometry across park fills.
- Simplify shared neighborhood boundaries while preserving the combined city footprint and recognizable park, coast, and road-crossing geometry.

## 1.2.0

### Added

- Add `@kahwee/sf-map-svg/custom-map`, a data-injected renderer entry point that lets consumers bundle only the geographic datasets they provide.
- Add public styled geographic overlays, explorer theme tokens, configurable labels, and optional controls.
- Validate SVG overlay numeric attributes and add an interactive data-injected entry point so consumers can provide only the geographic datasets they use.
- Add a Pages ballot-measures explorer for certified June 2026 local results, district comparisons, shareable selections, and official downloads.
- Build the Pages demos and SVG downloads from the published npm version, with visible release metadata, installation copying, and release links.
- Make the measures atlas a full-screen map with side-by-side comparisons, touch navigation, overlay tables and sources, and a focus view.
- Refresh the Pages layout for mobile and add expandable certified election results with SVG/CSV/JSON exports.

## 1.1.0

### Added

- Public [GitHub Pages explorer](https://kahwee.github.io/sf-map-svg/) with neighborhood search, map modes, usage tips, SVG examples, and GeoJSON downloads.
- Automatic Pages builds and deployment from `main`, plus `pnpm build:pages` for local previews.
- Optional `@kahwee/sf-map-svg/transit` browser component and an [embeddable transit demo](https://kahwee.github.io/sf-map-svg/transit.html). The schematic BART journey connects official station locations with straight segments; it does not represent actual tracks or live service.
- Play/pause controls, a keyboard-accessible journey slider, pause-on-hidden behavior, and a Storybook transit example. Animation starts paused.

### Changed

- Reorganize the README around installation, choosing an API, static and interactive options, geographic data, development, and Pages deployment.

### Fixed

- Release map listeners, observers, animation frames, and download URLs when explorer initialization fails. Add browser regression coverage for failed initialization.

## 1.0.0

- Publish the stable 1.0 API with public npm access and a public source repository.
- Add the reusable interactive map entrypoint, controlled viewport and selection APIs, keyboard/touch navigation, and marker selection.
- Add interactive examples, Storybook stories, and viewport/navigation regression checks.
- Add district/neighborhood explorer modes and a labels toggle, with fixed screen-size labels while zooming.
- Add a master visible-label switch for standalone SVGs.
- Add nine optional key-road landmarks from DataSF centerlines, public JSON, and zoom-aware explorer labels.
- Add a transit-inspired map theme with pale water, quiet land, green parks, and blue station symbols.
- Refine the neighborhood explorer presentation and map legend.
- Add a transit example and Storybook preset.

## 0.4.1

- Migrate library source to strict TypeScript 7 with generated JavaScript and declarations.
- Replace Prettier with Biome formatting, import organization, and recommended lint rules.

## 0.4.0

- Add a browser neighborhood explorer with alias search, selection, boundary zoom, and GeoJSON downloads.
- Adapt explorer labels to zoom and viewport size while preserving static SVG defaults.
- License software under MIT and add npm release automation and packaged-consumer checks.

## 0.3.0

- Enable public npm distribution with explicit public registry access.
- Remove realtor boundary sliver overlaps while preserving all 92 neighborhoods and their combined footprint; enforce disjoint interiors in regression tests.
- Use the 92 SFAR realtor neighborhoods by default for map outlines, data lookup, and Storybook. Other source collections remain available.
- Move all geographic data to exported canonical GeoJSON files, preserving district display extras.
- Expose complete SF Find (117), analysis (41), and realtor (92) neighborhood collections with source-specific canonical names and documented aliases.
- Add immutable data helpers, exact-name lookup, source-aware search, and a typed geometry export.
- Split SVG layers from orchestration and reuse projected district paths.
- Reject longitude values that could overflow SVG coordinates.
- Add neighborhood explorer stories, JSON downloads, independent overlay stories, and data integrity checks.

## 0.2.0

- Add optional park and landmark highlights using DataSF property boundaries.
- Add all eight San Francisco BART stations using official station coordinates.
- Add overlay color options, TypeScript declarations, source records, and SVG checks.
- Add Storybook 10.6 with eight interactive examples and API controls.
- Add usage examples, contributor instructions, and AGENTS.md.
- Update GitHub Actions and validate Storybook and package builds across supported Node versions.
- Configure weekly Dependabot updates for development dependencies and Actions.
- Keep existing layer defaults unchanged, runtime dependencies at zero, and distribution private.

## 0.1.1

- Separate geometry and projection helpers from SVG layer rendering.
- Cache immutable coast bounds across renders.
- Validate complete SVG documents as XML in regression tests.
- Remove invalid XML control characters from user-supplied labels.
- Specify even-odd clipping for coastline holes.
- Standardize formatting and document contribution and private release workflows.
- Distribute through private GitHub releases; disable npm publication.
- Exclude original Site application code and internal source identifiers.

## 0.1.0

- Extract Site version 6 into a standalone SVG renderer.
- Bundle 2002, 2012 and 2022 districts plus optional SF Find neighborhood boundaries.
- Preserve source provenance, palette, coast, labels and optional highways.
