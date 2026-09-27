# SF Map SVG

Offline, self-contained San Francisco SVG maps. The package has no runtime dependencies. Geography is always an explicit import; the root entry does not bundle data.

[Live examples](https://kahwee.github.io/sf-map-svg/examples.html) · [Storybook source](stories/) · [Geographic sources](SOURCES.md) · [v3 migration](docs/migration-v3.md)

## Install

```sh
pnpm add @kahwee/sf-map-svg
```

Node 22.12+ is required for server rendering. Browser maps need a DOM and a bundler that supports JSON imports.

## Static SVG

```ts
import { renderMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const { svg, project, viewBox } = renderMap(fullMapData.map, {
  year: 2022,
  landmarks: true,
  bartStations: true,
});
```

`renderMap(data, options)` returns SVG markup and matching projection helpers. Import `/data/full` only when all packaged geography is needed. For static rendering without interactive lookup collections, import `staticMapData` from `/data/static`. Small maps can compose selected JSON exports from `/data/*` and pass them as `StaticMapData`. `getLayerPaths(data, options)` returns fitted geographic paths without SVG markup.

Static options include `theme`, `width`, `height`, `padding`, `year` (2002, 2012, 2022), `districtLines`, `districtFills`, `districtStyle`, `districtLabels`, `neighborhoodLines`, `labels`, `highways`, `keyRoads`, `roadLabels`, `landmarks`, `bartStations`, `markers`, `overlays`, `title`, `idPrefix`, and `colors`. Each optional layer is independent. User-supplied text and attributes are escaped in SVG output.

## Interactive map

```ts
import { createMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const map = createMap(fullMapData, {
  mode: 'neighborhoods',
  source: 'realtor',
  neighborhood: 'Inner Mission',
  layers: { bartStations: true },
  features: { motion: true },
  appearance: { theme: 'districts' },
});
document.querySelector('#map')?.append(map.element);
map.on('neighborhoodchange', ({ name }) => console.log(name));
map.camera.zoom(1.5);
// When the view is removed:
map.destroy();
```

`createMap(data, options)` returns a controller. Use `map.element` for mounting, `map.configure({ features, layers, controls })` for runtime switches, `map.camera` for pan/zoom/fit/reset, and `map.on()` for typed events. Appearance is set at construction. SFAR realtor neighborhoods are the default when supplied; SF Find and analysis are explicit alternate sources. The `/data/full` preset includes all three collections and historical districts.

Construction options include `mode` (`basemap`, `neighborhoods`, or `districts`), `source`, `neighborhood`, `year`, `labels`, `layers`, `controls`, `features`, `appearance`, `markers`, `overlays`, `legend`, `strings`, `attribution`, `fitPadding`, and touch navigation settings. `features` holds motion, marker entrances, selected marker rings, clustering, north arrow, and scale bar. `appearance` holds theme, color tokens, label and area styles, marker colors and sizes, and district styling. `layers` controls district fill/line/labels, neighborhood lines/labels, landmarks, BART, highways, key roads, and road labels. See the exported `MapOptions` type for exact values and the [Storybook examples](stories/) for live controls.

The controller also supports marker, neighborhood, and district selection; district year and style changes; source and mode changes; labels and touch navigation; screen projection; and typed `markerchange`, `neighborhoodchange`, `districtchange`, `districthover`, `districtactivate`, `districtyearchange`, `overlayactivate`, `clusteractivate`, `viewportchange`, and `mapresize` events. `destroy()` releases browser resources; operations after destruction throw.

For a small guide, import `guideMapData` from `/guide/data` and pass it to `createMap`. The optional `/guide` entry also provides `createGuideMap`, `mountGuideMap`, and detailed-data loading for existing guide layouts. `/transit` provides the standalone schematic transit animation. See [examples](docs/EXAMPLES.md) and [consumer integration](docs/consumer-integration.md).

## Data and development

Canonical geography is in [`data/`](data/README.md), with provenance in [`SOURCES.md`](SOURCES.md). The public `/data` entry exposes lookup, catalog, district maps, and source-specific neighborhood collections. These are deeply frozen; clone before editing.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
pnpm build-storybook
pnpm test:stories:coverage
pnpm test:package
```

The [contributing guide](CONTRIBUTING.md) explains the geographic and release checks. Version 3 removes the five old compatibility entry points; [migrate before upgrading](docs/migration-v3.md).
