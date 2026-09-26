# San Francisco SVG maps

Private package extracted from KahWee’s **San Francisco District Map** Site. Draws a self-contained SVG with bundled geometry and no runtime dependencies, tiles, WebGL, or network requests.

```js
import { renderSFMap, createSFMap } from '@kahwee/sf-map-svg';

const svg = renderSFMap({
  year: 2022,
  districtLines: true,
  neighborhoodLines: true, // optional; off by default
  markers: [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park' }],
});
```

Write `svg` to a `.svg` file or embed it in your page. For Astro, render it with `<div set:html={svg} />`. Text and attribute values are XML escaped.

## Layers and options

| Option | Default | Purpose |
| --- | --- | --- |
| `year` | `2022` | District boundaries: `2002`, `2012`, or `2022` |
| `districtLines` | `true` | Supervisorial district outlines |
| `neighborhoodLines` | `false` | Dashed SF Find neighborhood outlines |
| `districtFills` | `true` | Original Site’s eleven muted district colors |
| `districtLabels` | `true` | District number badges |
| `highways` | `false` | Original Site’s highway geometry |
| `width`, `height` | `800`, `800` | SVG viewBox and intrinsic size |
| `padding` | `28` | Space around the coast |
| `markers` | `[]` | Points with `id`, `lng`, `lat`, optional `label`, `color`, `selected` |
| `colors` | Built-in palette | Override `water`, `land`, `district`, `neighborhood`, `highway`, `label`, `marker`, `selected` |
| `title` | `San Francisco map` | Accessible SVG title |
| `idPrefix` | Unique per process | Set explicitly for deterministic output or independent server renders |

For a plain outline map, set `districtFills: false`. Neighborhood areas are approximate **2006 SF Find areas**, not legal boundaries or a historical layer matched to the district year. See [SOURCES.md](SOURCES.md).

`createSFMap(options)` returns `{ svg, project, viewBox }`. `project([longitude, latitude])` gives matching SVG coordinates for custom overlays. Named exports also include `districtYears`, `districtColors`, and `neighborhoodNames`.

## Private installation

The repository and GitHub npm package are private. Configure your project’s `.npmrc`:

```ini
@kahwee:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Supply a GitHub token with package read access through your environment or CI secret, then run:

```sh
pnpm add @kahwee/sf-map-svg@0.1.0
```

Never commit the token. Build systems consuming this package need the same read access. In a GitHub Actions consumer, grant that repository access in the package settings and use its `GITHUB_TOKEN` with `packages: read`.

## Development

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm demo
```

Open `examples/generated/index.html` to compare district and neighborhood maps. Generated SVG files are there too. Tag a release as `v<package version>` to publish through GitHub Actions.

The original renderer and its source manifest are retained under `provenance/sites/` for traceability; they are excluded from the published package. The package uses a small Mercator SVG renderer while retaining the Site’s boundary geometry, coastline, palette, district labels, and highway data.
