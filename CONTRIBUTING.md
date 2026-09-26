# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 22.12 or newer.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm build-storybook
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

## Interactive examples and dependency updates

Run `pnpm storybook` and edit `stories/SFMap.stories.js`. Keep Stories using the public API so examples exercise the same renderer consumers use. Add stories for new layers or substantial options. Do not reuse a fixed `idPrefix` across stories because Docs renders several maps on one page.

Dependabot proposes weekly npm and GitHub Actions updates. Keep Storybook packages on matching versions and review the CI results before merging. `pnpm audit` checks known advisories. The package must retain zero runtime dependencies.
