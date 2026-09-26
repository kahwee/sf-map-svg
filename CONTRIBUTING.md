# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 22 or newer.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm demo
```

## Source layout

| Path              | Responsibility                                                  |
| ----------------- | --------------------------------------------------------------- |
| `src/index.js`    | Public API, options, accessible SVG, layers and markers         |
| `src/geometry.js` | Mercator projection and GeoJSON path conversion                 |
| `src/data.js`     | Bundled source geometry; preserve original coordinate precision |
| `src/index.d.ts`  | Public TypeScript declarations                                  |
| `test/`           | Rendering, XML, projection and input validation                 |
| `examples/`       | Reproducible SVG comparison page                                |

Keep runtime dependencies at zero. Format maintained code with `pnpm format`; bundled geometry and original source references are intentionally excluded. Changes to the API need matching declarations and documentation. Geometry changes need dated source records in `SOURCES.md`.

For rendering changes, inspect the example page on desktop and at 390 px. Run `pnpm check` and inspect `pnpm pack` contents before releasing. Never include credentials, node_modules, or source extraction credentials in the repository or archive.

## Private GitHub releases

1. Update the version and changelog.
2. Run `pnpm check`, generate examples, and inspect `pnpm pack` contents.
3. Confirm the repository remains private.
4. Tag the reviewed commit and create a private GitHub release with the package archive and map SVG examples.

Keep `private: true` in the package manifest to prevent accidental npm publication. Never include credentials, site account identifiers, original site application files, or unrelated YorkSF content. Only the map renderer, public geometry, tests, examples, and supporting documentation belong here.
