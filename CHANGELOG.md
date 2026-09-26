# Changelog

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
