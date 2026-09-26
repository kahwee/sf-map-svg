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

GitHub Actions checks Node 22, 24, and 26 on pushes and pull requests. Each job checks formatting, data, types, and tests, builds the examples and Storybook, then installs a packed archive in a temporary consumer to verify the published entrypoints. Run the same package check locally with `pnpm test:package`.

The `publish.yml` workflow publishes stable releases when a GitHub release is published, or when manually dispatched with an existing `vMAJOR.MINOR.PATCH` tag. It checks out that tag, requires its package version to match, reruns all checks, and publishes the exact archive that passed the consumer test. Prerelease tags are rejected. No package is published on normal pushes or pull requests.

Before the first automated release, configure the package's npm Trusted Publisher settings:

- Provider: GitHub Actions
- Organization or user: `kahwee`
- Repository: `sf-map-svg`
- Workflow filename: `publish.yml`
- Environment: leave blank (the workflow does not use a GitHub environment)
- Allowed action: enable direct `npm publish`

This npm-side trust configuration must match the workflow identity. The workflow uses a GitHub-hosted runner, Node 24, and `id-token: write`; it needs no stored npm token. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for setup. npm generates provenance when the repository and package meet its eligibility requirements; a private source repository does not receive public provenance. GitHub Actions must also be enabled with available runner minutes/billing before workflows can execute.

To release:

1. Update the version and changelog.
2. Run `pnpm check`, `pnpm demo`, `pnpm build-storybook`, and `pnpm test:package`.
3. Review and push the changes, tag the reviewed commit as `v<version>`, and publish its GitHub release.
4. Inspect the publish workflow result, verify the registry version, and install that version in a clean project. A manual dispatch with the same tag can retry a failed attempt; npm rejects republishing an existing version.

`publishConfig` fixes public access and the npm registry. Never include credentials, site account identifiers, original site application files, or unrelated YorkSF content. Only the map renderer, public geometry, tests, examples, and supporting documentation belong here. The software uses MIT; source geographic data retains the terms and attribution recorded in `SOURCES.md`.

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
