# San Francisco SVG maps

![District fills, optional neighborhood boundaries, and plain outlines](docs/map-preview.png)

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

| Option              | Default             | Purpose                                                                                        |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `year`              | `2022`              | District boundaries: `2002`, `2012`, or `2022`                                                 |
| `districtLines`     | `true`              | Supervisorial district outlines                                                                |
| `neighborhoodLines` | `false`             | Dashed SF Find neighborhood outlines                                                           |
| `districtFills`     | `true`              | Original Site’s eleven muted district colors                                                   |
| `districtLabels`    | `true`              | District number badges                                                                         |
| `highways`          | `false`             | Original Site’s highway geometry                                                               |
| `width`, `height`   | `800`, `800`        | SVG viewBox and intrinsic size                                                                 |
| `padding`           | `28`                | Space around the coast                                                                         |
| `markers`           | `[]`                | Points with `id`, `lng`, `lat`, optional `label`, `color`, `selected`                          |
| `colors`            | Built-in palette    | Override `water`, `land`, `district`, `neighborhood`, `highway`, `label`, `marker`, `selected` |
| `title`             | `San Francisco map` | Accessible SVG title                                                                           |
| `idPrefix`          | Unique per process  | Set explicitly for deterministic output or independent server renders                          |

For a plain outline map, set `districtFills: false`. Neighborhood areas are approximate **2006 SF Find areas**, not legal boundaries or a historical layer matched to the district year. See [SOURCES.md](SOURCES.md).

`createSFMap(options)` returns `{ svg, project, viewBox }`. `project([longitude, latitude])` gives matching SVG coordinates for custom overlays. Named exports also include `districtYears`, `districtColors`, and `neighborhoodNames`.

## Private installation

The repository is private. You can install directly from GitHub with an authenticated SSH key:

```sh
pnpm add git+ssh://git@github.com/kahwee/sf-map-svg.git#v0.1.0
```

A private release also contains the package archive and ready-to-use SVG files.

### npmjs (publication pending)

Version 0.1.1 targets **npmjs with restricted access**. Once published, authenticate with an account that has access:

```sh
pnpm login --registry=https://registry.npmjs.org
pnpm add @kahwee/sf-map-svg@0.1.1
```

For CI, provide a read-only npm token through a secret and use:

```ini
@kahwee:registry=https://registry.npmjs.org
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Never commit the token. Private npm packages require an eligible paid npm account. See [the release workflow](CONTRIBUTING.md#private-npm-releases) for publishing and verification.

## Development

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm demo
```

Open `examples/generated/index.html` to compare district and neighborhood maps. Generated SVG files are there too. See [CONTRIBUTING.md](CONTRIBUTING.md) for source structure, checks and release steps. GitHub Actions runs validation; private npm publication is performed locally.

The original renderer and its source manifest are retained under `provenance/sites/` for traceability; they are excluded from the published package. The package uses a small Mercator SVG renderer while retaining the Site’s boundary geometry, coastline, palette, district labels, and highway data.
