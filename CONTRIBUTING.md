# Working on SF Map SVG

Use pnpm 12 (declared in `package.json`) and Node 22.12 or newer.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm build-storybook
pnpm exec playwright install chromium
pnpm test:stories
pnpm test:stories:coverage
```

## Source layout

| Path              | Responsibility                                          |
| ----------------- | ------------------------------------------------------- |
| `src/index.ts`    | Public API, options, accessible SVG, layers and markers |
| `src/geometry.ts` | Mercator projection and GeoJSON path conversion         |
| `src/data.ts`     | Internal adapter over canonical JSON geometry           |
| `src/types.ts`  | Public TypeScript declarations                          |
| `test/`           | Rendering, XML, projection and input validation         |
| `examples/`       | Reproducible SVG comparison page                        |

Keep runtime dependencies at zero. Library source is strict TypeScript 7. `pnpm build` emits JavaScript, declarations, and imported JSON to `dist/`; package exports point at that build. Do not maintain parallel handwritten declarations. Tests exercise the compiled output; Storybook imports TypeScript source for live reload.

Use `pnpm format` for Biome formatting, import organization, and safe lint fixes; `pnpm lint` checks formatting and recommended lint rules. Canonical geographic JSON and generated output are excluded. Biome does not format Markdown or GitHub workflow YAML. Changes to the API need matching declarations and documentation. Geometry changes need dated source records in `SOURCES.md`.

For rendering changes, inspect the example page on desktop and at 390 px. Run `pnpm check` and inspect `pnpm pack` contents before releasing. Never include credentials, node_modules, or source extraction credentials in the repository or archive.

## Public npm releases

GitHub Actions checks Node 22, 24, and 26 on pushes and pull requests. Each job checks formatting, data, types, and tests, builds the examples, Storybook, and the offline Pages preview, then installs a packed archive in a temporary consumer to verify the published entrypoints. A separate Chromium job runs Storybook interactions and coverage. Run the same package check locally with `pnpm test:package`.

The `publish.yml` workflow publishes stable releases when a GitHub release is published, or when manually dispatched with an existing `vMAJOR.MINOR.PATCH` tag. It checks out that tag, requires its package version to match, reruns all checks including Chromium Storybook interactions, and publishes the exact archive that passed the consumer test. Prerelease tags are rejected. No package is published on normal pushes or pull requests.

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
2. Run `pnpm check`, `pnpm demo`, `pnpm build-storybook`, `pnpm test:stories:coverage`, and `pnpm test:package`.
3. Review and push the changes, tag the reviewed commit as `v<version>`, and publish its GitHub release.
4. Inspect the publish workflow result, verify the registry version, and install that version in a clean project. A manual dispatch with the same tag can retry a failed attempt; npm rejects republishing an existing version.

`publishConfig` fixes public access and the npm registry. Never include credentials, site account identifiers, original site application files, or unrelated YorkSF content. Only the map renderer, public geometry, tests, examples, and supporting documentation belong here. The software uses MIT; source geographic data retains the terms and attribution recorded in `SOURCES.md`.

## Interactive examples and dependency updates

Run `pnpm storybook` and edit `stories/SFMap.stories.js`. Keep stories using the public API so examples exercise the same renderer consumers use. Add stories for new layers or substantial options. Do not reuse a fixed `idPrefix` across stories because Docs renders several maps on one page. Storybook 10 and Vitest run every story as a Chromium rendering check; add a `play` function for behavior that needs interaction coverage. The accessible guide story checks route overlays, overlapping marker selection, and keyboard input. Run `pnpm exec playwright install chromium` once locally before `pnpm test:stories`.

`pnpm test:stories:coverage` writes JSON summary and LCOV reports to `coverage/storybook/`. Coverage includes library code in `src/` and excludes stories, generated files, and geographic JSON. It measures code reached by Storybook browser checks; Node tests still run separately through `pnpm test`. The coverage floor is deliberately below the current browser baseline to catch large regressions without presenting this as complete library coverage. GitHub CI uploads the report as an artifact even if a browser check fails. npm publishing and Pages deployment also require this check to pass.

Dependabot proposes weekly npm and GitHub Actions updates, grouping Storybook, Vitest, and GitHub Actions updates by family. Keep Storybook packages on matching versions and keep Vitest within the addon peer range; review the CI results before merging. The weekly maintenance workflow runs `pnpm audit --audit-level high`; run `pnpm outdated` to review available updates. React, Vitest, and Playwright are development dependencies for Storybook testing; the published package must retain zero runtime dependencies.

## Renderer and geographic data structure

- `data/*.json`: canonical GeoJSON, source definitions, names, aliases, and rendering anchors; no duplicate geometry in JavaScript.
- `data/index.ts` and `data/types.ts`: immutable data helpers and typed name lookup, separate from the map renderer.
- `src/layers.ts`: small layer renderers; drawing order remains explicit in `src/index.ts`.
- `src/svg.ts`: shared XML escaping, numeric formatting, and stroke attributes.
- `scripts/build-data-catalog.mjs`: deterministic metadata-only catalog generator. Run `pnpm data:catalog`; `pnpm check` rejects a stale catalog.
- `stories/NeighborhoodData.stories.js`: source-aware neighborhood lookup and projection example.

Read `data/README.md` before changing schemas or names. Keep canonical names scoped to their definition source, preserve source labels, and cite alias evidence. New geometry requires a source record. Do not merge same-name polygons from different source collections. Tests include pre-migration geometry digests to catch accidental loss of district display extras.

## Pages release previews

`pnpm build:pages` builds an offline local preview from the current compiled package and labels it as a local preview. `pnpm build:pages --released` installs npm’s current stable version into a temporary directory, bundles its browser components, and generates its SVG downloads. It requires registry access; the deployed site needs no runtime CDN or registry requests. `pages-dist/release.json` records the version and source.

Pages deploys on `main` updates and after a successful npm publishing workflow. Release-triggered builds wait up to five minutes for npm to expose the exact published version. If processing takes longer, rerun the failed Pages workflow.
