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
| `neighborhoodLines` | `false`             | Dashed SFAR realtor neighborhood outlines                                                                                  |
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

For a plain outline map, set `districtFills: false`. Neighborhood areas are **August 2010 SFAR realtor areas**, not legal boundaries or a historical layer matched to the district year. See [SOURCES.md](SOURCES.md).

`createSFMap(options)` returns `{ svg, project, viewBox }`. `project([longitude, latitude])` gives matching SVG coordinates for custom overlays. Named exports also include `districtYears`, `districtColors`, and `neighborhoodNames`.

## Installation

```sh
pnpm add @kahwee/sf-map-svg
```

The package is published publicly on npm. Geographic JSON files are included in the package. See `LICENSE` and `SOURCES.md` for software and source-data rights.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm demo
```

Open `examples/generated/index.html` to compare district and neighborhood maps. Generated SVG files are there too. See [CONTRIBUTING.md](CONTRIBUTING.md) for source structure, checks and release steps. GitHub Actions runs validation; npm releases use public access.

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

Map stories cover the default map, combined and independent landmark/BART layers, neighborhoods, outlines, historical district years, custom markers, a custom palette, and a narrow map. The Data / Neighborhood explorer adds examples for comparing Mission, Outer Mission, SoMa, and NoPa across source definitions. Controls edit map options live; the Docs tab shows usage examples. Storybook and Vite are development dependencies only and are excluded from the package archive. Development requires Node 22.12+ and pnpm 12. Only esbuild's dependency build script is enabled in `pnpm-workspace.yaml`.

Dependabot checks npm dependencies and GitHub Actions weekly, grouping Storybook updates. CI validates formatting, SVG tests, generated examples, Storybook builds, and package creation on Node 22 and 26. Dependency PRs require review; updates are not merged automatically.

## Accessible JSON data and neighborhood lookup

All map geometry is available through stable JSON package exports. There are three district files (2002, 2012, 2022), the full 117 SF Find neighborhoods, 41 analysis neighborhoods, 92 realtor-defined areas, and separate coastline, highway, landmark, and BART files. Neighborhood records include a canonical display name, exact source name, stable ID, aliases where documented, source definition, and full polygon geometry.

```js
import neighborhoods from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };
import districts2022 from '@kahwee/sf-map-svg/data/districts-2022.json' with { type: 'json' };
import { getNeighborhood, searchNeighborhoods } from '@kahwee/sf-map-svg/data';

const mission = getNeighborhood('Inner Mission');
const outerMission = getNeighborhood('Outer Mission');
const nopa = getNeighborhood('NoPa', { source: 'realtor' });
const matchingDefinitions = searchNeighborhoods('mission');
```

These are 250 **source-specific definitions**, not 250 distinct neighborhoods. Canonical names are package display names, and boundaries reflect each documented source rather than a claimed universal consensus. Mission and Outer Mission remain distinct. JSON files are the source of truth used by the renderer; the default map and lookup use the 92 SFAR realtor neighborhoods. See [the data API guide](data/README.md) for all filenames, schema, lookup rules, source comparisons, and custom SVG overlays. Storybook provides downloadable JSON files beside its neighborhood examples.

## Interactive neighborhood explorer

The browser explorer includes canonical-name and alias search, source selection, neighborhood outlines, zoom controls, and GeoJSON downloads. SFAR realtor definitions are selected by default; SF Find and analysis neighborhoods remain separate choices.

```js
import { createNeighborhoodExplorer } from '@kahwee/sf-map-svg/explorer';

const explorer = createNeighborhoodExplorer({ source: 'realtor' });
document.querySelector('#map').append(explorer);
explorer.selectNeighborhood('NoPa');

// Before removing the component, release its observers and event listeners.
// explorer.destroy();
```

Call this browser-only factory after a DOM is available. Importing it does not mount anything. Options include `source`, an optional initial `neighborhood` name or alias, and district `year`. The returned element also exposes `setSource(source)`, `zoomBy(factor)`, and `resetView()`.

Selected downloads are one-feature GeoJSON FeatureCollections retaining source attribution and boundary-processing metadata.

At city scale, labels stay sparse. Zooming reveals neighborhood and BART names, with label sizing and collision checks based on the visible viewport. Station points remain visible. The static `renderSFMap` API keeps its existing labels and defaults.

Run `pnpm demo`, serve the repository root over HTTP, and open `examples/generated/explorer.html`. Storybook includes city, selected neighborhood, alternative-source, and mobile examples.

## License

Software is licensed under MIT. Geographic datasets retain their source terms and attribution requirements; see [SOURCES.md](SOURCES.md).
