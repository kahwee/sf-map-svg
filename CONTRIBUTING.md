# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 22.12 or newer.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm build-storybook
```

## Source layout

| Path              | Responsibility                                          |
| ----------------- | ------------------------------------------------------- |
| `src/index.js`    | Public API, options, accessible SVG, layers and markers |
| `src/geometry.js` | Mercator projection and GeoJSON path conversion         |
| `src/data.js`     | Internal adapter over canonical JSON geometry           |
| `src/index.d.ts`  | Public TypeScript declarations                          |
| `test/`           | Rendering, XML, projection and input validation         |
| `examples/`       | Reproducible SVG comparison page                        |

Keep runtime dependencies at zero. Format maintained code with `pnpm format`; bundled geometry and original source references are intentionally excluded. Changes to the API need matching declarations and documentation. Geometry changes need dated source records in `SOURCES.md`.

For rendering changes, inspect the example page on desktop and at 390 px. Run `pnpm check` and inspect `pnpm pack` contents before releasing. Never include credentials, node_modules, or source extraction credentials in the repository or archive.

## Public npm releases

1. Update the version and changelog.
2. Run `pnpm check`, `pnpm demo`, and `pnpm build-storybook`.
3. Inspect `pnpm pack` contents and smoke-test the archive in a clean consumer project.
4. Commit and push the reviewed changes, then publish with `npm publish --access public`.
5. Verify the published registry version and installation, then tag the released commit.

`publishConfig` fixes public access and the npm registry. Publishing requires npm authentication. Never include credentials, site account identifiers, original site application files, or unrelated YorkSF content. Only the map renderer, public geometry, tests, examples, and supporting documentation belong here.

## Interactive examples and dependency updates

Run `pnpm storybook` and edit `stories/SFMap.stories.js`. Keep Stories using the public API so examples exercise the same renderer consumers use. Add stories for new layers or substantial options. Do not reuse a fixed `idPrefix` across stories because Docs renders several maps on one page.

Dependabot proposes weekly npm and GitHub Actions updates. Keep Storybook packages on matching versions and review the CI results before merging. `pnpm audit` checks known advisories. The package must retain zero runtime dependencies.

## Renderer and geographic data structure

- `data/*.json`: canonical GeoJSON, source definitions, names, aliases, and rendering anchors; no duplicate geometry in JavaScript.
- `data/index.js` and `data/index.d.ts`: immutable data helpers and typed name lookup, separate from the map renderer.
- `src/layers.js`: small layer renderers; drawing order remains explicit in `src/index.js`.
- `src/svg.js`: shared XML escaping, numeric formatting, and stroke attributes.
- `scripts/build-data-catalog.mjs`: deterministic metadata-only catalog generator. Run `pnpm data:catalog`; `pnpm check` rejects a stale catalog.
- `stories/NeighborhoodData.stories.js`: source-aware neighborhood lookup and projection example.

Read `data/README.md` before changing schemas or names. Keep canonical names scoped to their definition source, preserve source labels, and cite alias evidence. New geometry requires a source record. Do not merge same-name polygons from different source collections. Tests include pre-migration geometry digests to catch accidental loss of district display extras.
