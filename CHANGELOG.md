# Changelog

## Unreleased

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
