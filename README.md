# San Francisco SVG maps

![District fills, optional neighborhood boundaries, and plain outlines](docs/map-preview.png)

Private package extracted from KahWee’s **San Francisco District Map** Site. Draws a self-contained SVG with bundled geometry and no runtime dependencies, tiles, WebGL, or network requests.

```js
import { renderSFMap, createSFMap } from '@kahwee/sf-map-svg';

const svg = renderSFMap({
  year: 2022,
  districtLines: true,
  landmarks: true, // parks with labels
  bartStations: true, // all eight SF stations
  highways: true,
  neighborhoodLines: true, // optional; off by default
  markers: [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park' }],
});
```

Write `svg` to a `.svg` file or embed it in your page. For Astro, render it with `<div set:html={svg} />`. Text and attribute values are XML escaped.

## Layers and options

| Option              | Default             | Purpose                                                                                                                    |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `year`              | `2022`              | District boundaries: `2002`, `2012`, or `2022`                                                                             |
| `districtLines`     | `true`              | Supervisorial district outlines                                                                                            |
| `neighborhoodLines` | `false`             | Dashed SF Find neighborhood outlines                                                                                       |
| `districtFills`     | `true`              | Original Site’s eleven muted district colors                                                                               |
| `districtLabels`    | `true`              | District number badges                                                                                                     |
| `highways`          | `false`             | Original Site’s highway geometry                                                                                           |
| `landmarks`         | `false`             | Golden Gate Park, Presidio, Lincoln Park, Twin Peaks, Dolores Park, and McLaren Park                                       |
| `bartStations`      | `false`             | Eight San Francisco BART stations with blue rings and names                                                                |
| `width`, `height`   | `800`, `800`        | SVG viewBox and intrinsic size                                                                                             |
| `padding`           | `28`                | Space around the coast                                                                                                     |
| `markers`           | `[]`                | Points with `id`, `lng`, `lat`, optional `label`, `color`, `selected`                                                      |
| `colors`            | Built-in palette    | Override `water`, `land`, `district`, `neighborhood`, `highway`, `park`, `landmark`, `bart`, `label`, `marker`, `selected` |
| `title`             | `San Francisco map` | Accessible SVG title                                                                                                       |
| `idPrefix`          | Unique per process  | Set explicitly for deterministic output or independent server renders                                                      |

For a plain outline map, set `districtFills: false`. Neighborhood areas are approximate **2006 SF Find areas**, not legal boundaries or a historical layer matched to the district year. See [SOURCES.md](SOURCES.md).

`createSFMap(options)` returns `{ svg, project, viewBox }`. `project([longitude, latitude])` gives matching SVG coordinates for custom overlays. Named exports also include `districtYears`, `districtColors`, and `neighborhoodNames`.

## Private installation

The repository is private. You can install directly from GitHub with an authenticated SSH key:

```sh
pnpm add git+ssh://git@github.com/kahwee/sf-map-svg.git#v0.2.0
```

A private release also contains the package archive and ready-to-use SVG files.

The package is distributed through the **private GitHub repository and its releases**. npm registry publication is disabled with `private: true` in `package.json`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm demo
```

Open `examples/generated/index.html` to compare district and neighborhood maps. Generated SVG files are there too. See [CONTRIBUTING.md](CONTRIBUTING.md) for source structure, checks and release steps. GitHub Actions runs validation; releases are published only to this private GitHub repository.

The package uses a small Mercator SVG renderer while retaining the Site’s boundary geometry, coastline, palette, district labels, and highway data.

Enable `landmarks`, `bartStations`, and `highways` together for the featured example. Park fills use `colors.park`, park labels use `colors.landmark`, and station rings and labels use `colors.bart`. These current geographic overlays are independent of the district year; BART stations are city-only (Daly City is outside the map). Station positions are geographic points, not a route diagram.

## Examples

### Landmarks, BART stations, and highways

```js
import { renderSFMap } from '@kahwee/sf-map-svg';
import { writeFile } from 'node:fs/promises';

await writeFile(
  'san-francisco.svg',
  renderSFMap({
    landmarks: true,
    bartStations: true,
    highways: true,
  }),
);
```

### Plain map with a selected place

```js
const svg = renderSFMap({
  districtFills: false,
  districtLabels: false,
  landmarks: true,
  markers: [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park', selected: true }],
});
```

### Match a site's colors

```js
const svg = renderSFMap({
  landmarks: true,
  bartStations: true,
  colors: { park: '#c4d4b1', landmark: '#3e6346', bart: '#795285' },
});
```

## Storybook

```sh
pnpm storybook        # http://127.0.0.1:6006
pnpm build-storybook  # static output in storybook-static/
```

Eight stories cover the default map, landmarks and BART, neighborhoods, outlines, historical district years, custom markers, and a custom palette. Controls edit map options live; the Docs tab shows usage examples. Storybook and Vite are development dependencies only and are excluded from the package archive. Development requires Node 22.12+ and pnpm 12. Only esbuild's dependency build script is enabled in `pnpm-workspace.yaml`.

Dependabot checks npm dependencies and GitHub Actions weekly, grouping Storybook updates. CI validates formatting, SVG tests, generated examples, Storybook builds, and package creation on Node 22 and 26. Dependency PRs require review; updates are not merged automatically.
