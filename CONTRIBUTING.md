# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 22 or newer.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm demo
```

## Source layout

| Path                | Responsibility                                                  |
| ------------------- | --------------------------------------------------------------- |
| `src/index.js`      | Public API, options, accessible SVG, layers and markers         |
| `src/geometry.js`   | Mercator projection and GeoJSON path conversion                 |
| `src/data.js`       | Bundled source geometry; preserve original coordinate precision |
| `src/index.d.ts`    | Public TypeScript declarations                                  |
| `test/`             | Rendering, XML, projection and input validation                 |
| `examples/`         | Reproducible SVG comparison page                                |
| `provenance/sites/` | Unmodified source reference; excluded from npm archive          |

Keep runtime dependencies at zero. Format maintained code with `pnpm format`; bundled geometry and original source references are intentionally excluded. Changes to the API need matching declarations and documentation. Geometry changes need dated source records in `SOURCES.md`.

For rendering changes, inspect the example page on desktop and at 390 px. Run `pnpm check` and inspect `pnpm pack` contents before releasing. Never include credentials, node_modules, or source extraction credentials in the repository or archive.

## Private npm releases

1. Update the version and changelog.
2. Run `pnpm check`, generate examples, and review the packed archive.
3. Authenticate to npmjs with `pnpm login --registry=https://registry.npmjs.org`.
4. Run `pnpm publish --access restricted`. Complete npm's interactive verification if prompted.
5. Confirm the published version and restricted access before creating the matching Git tag and release.

Private npm publication requires an eligible paid npm account. Do not change package access to public to work around a billing or permission error. CI validates code; publishing remains a deliberate local release step until trusted publishing is configured.
