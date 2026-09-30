# Working on this map

Read `CONTRIBUTING.md` and `SOURCES.md` before changing the renderer or geographic data.

- Preserve the soft district palette, precise coast, and lightweight SVG aesthetic.
- Keep rendering offline, self-contained, and free of runtime dependencies.
- Add geographic features as independent optional layers; keep existing defaults stable.
- Use verified geographic sources, preserve coordinate precision, and record source URLs and download dates in `SOURCES.md`. Never substitute neighborhood polygons for actual park boundaries.
- Keep `src/types.ts`, `docs/API.md` options, and examples aligned with the public API. Escape all user-supplied SVG text and attributes.
- Use Node 24+ and pnpm 12. Run `pnpm check`, `pnpm demo`, and `pnpm build-storybook` for source or dependency changes; check links and examples for docs-only edits. Keep Storybook examples aligned with the public API.
- For visual changes, use the installed `agent-browser` CLI in an isolated named session. Load `agent-browser skills get core --full` first. Inspect generated SVGs and the example page at desktop and 390 px widths, check label collisions and browser errors, and close the session afterward.
- Keep temporary screenshots out of git. Do not publish packages or releases unless requested. npm releases use public access as configured in `publishConfig`.
- Geographic JSON in `data/` is canonical. Do not restore embedded coordinate blobs in JavaScript. Read `data/README.md`, retain source-specific neighborhood identities, cite aliases, and regenerate the catalog with `pnpm data:catalog` after metadata changes.
- The user selected SFAR realtor neighborhood definitions as the default. Keep default rendering and lookup aligned with `data/neighborhoods-realtor.json`; preserve SF Find and analysis as explicit alternative datasets.
- Realtor neighborhood interiors must not overlap. Shared boundaries are allowed. Run the topology checks after geometry changes and preserve the combined footprint when normalizing source slivers.
