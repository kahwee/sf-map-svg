# Changelog

User-visible changes are recorded here. Unreleased entries describe changes on `main` that are not part of a tagged package release.

## Unreleased

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
- Update GitHub Actions and validate Storybook and package builds on Node 22 and 26.
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
