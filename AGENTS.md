# Working on this map

Read `CONTRIBUTING.md` and `SOURCES.md` before changing the renderer or geographic data.

- Preserve the soft district palette, precise coast, and lightweight SVG aesthetic.
- Keep rendering offline, self-contained, and free of runtime dependencies.
- Add geographic features as independent optional layers; keep existing defaults stable.
- Use verified geographic sources, preserve coordinate precision, and record source URLs and download dates in `SOURCES.md`. Never substitute neighborhood polygons for actual park boundaries.
- Keep `src/index.d.ts`, README options, and examples aligned with the public API. Escape all user-supplied SVG text and attributes.
- Use Node 22.12+ and pnpm 12. Run `pnpm check`, `pnpm demo`, and `pnpm build-storybook` after changes. Keep Storybook examples aligned with the public API.
- For visual changes, use the installed `agent-browser` CLI in an isolated named session. Load `agent-browser skills get core --full` first. Inspect generated SVGs and the example page at desktop and 390 px widths, check label collisions and browser errors, and close the session afterward.
- Keep temporary screenshots out of git. Do not publish packages or releases unless requested; retain `private: true`.
