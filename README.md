# SF Map SVG

Offline, self-contained San Francisco SVG maps. The package has no runtime dependencies. Geography is always an explicit import; the root entry does not bundle data.

[Live examples](https://kahwee.github.io/sf-map-svg/examples.html) · [Storybook source](stories/) · [Geographic sources](SOURCES.md) · [v3 migration](docs/migration-v3.md)

## Install

```sh
pnpm add @kahwee/sf-map-svg
```

Node 24+ is required for server rendering. Browser maps need a DOM and a bundler that supports JSON imports.

Upgrading from v3 to v4: update your Node runtime to 24 or newer. The map API, browser requirements, rendering, and animations are unchanged.

## Static SVG

```ts
import { renderMap } from '@kahwee/sf-map-svg';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';

const { svg, project, viewBox } = renderMap(staticMapData, {
  year: 2022,
  landmarks: true,
  bartStations: true,
});
```

`renderMap(data, options)` returns SVG markup and matching projection helpers. `/data/static` includes the complete static map without interactive lookup collections. Small maps can compose selected JSON exports from `/data/*` and pass them as `StaticMapData`. `getLayerPaths(data, options)` returns fitted geographic paths without SVG markup.

Static options include `theme`, `width`, `height`, `padding`, `year` (2002, 2012, 2022), `districtLines`, `districtFills`, `districtStyle`, `districtLabels`, `neighborhoodLines`, `labels`, `highways`, `keyRoads`, `roadLabels`, `landmarks`, `bartStations`, `markers`, `overlays`, `title`, `idPrefix`, `colors`, and `animation`. Each optional layer is independent. User-supplied text and attributes are escaped in SVG output.

`animation: true` (or `{ duration, delay }`) makes a static map draw itself with self-contained, scoped CSS: land fades in, the coast and lines draw, districts grow, then labels and points appear. It plays when the SVG is inserted into a page or loaded as an image, needs no JavaScript, and stays still under `prefers-reduced-motion`. Re-insert the markup to replay it. Default output is unchanged.

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

Construction options include `mode` (`basemap`, `neighborhoods`, or `districts`), `source`, `neighborhood`, `year`, `labels`, `layers`, `controls`, `features`, `appearance`, `markers`, `overlays`, `legend`, `strings`, `attribution`, and `fitPadding`. Enable map touch gestures with the touch control or `map.setTouchNavigation(true)`. `features` holds motion, marker entrances, selected marker rings, clustering, north arrow, scale bar, layer transitions, and district morphs. `appearance` holds theme, color tokens, label and area styles, marker colors and sizes, and district styling. `layers` controls district fill/line/labels, neighborhood lines/labels, landmarks, BART, highways, key roads, and road labels. See the exported `MapOptions` type for exact values and the [Storybook examples](stories/) for live controls.

The controller also supports marker, neighborhood, and district selection; district year and style changes; source and mode changes; labels and touch navigation; screen projection; and typed `markerchange`, `neighborhoodchange`, `districtchange`, `districthover`, `districtactivate`, `districtyearchange`, `overlayactivate`, `clusteractivate`, `viewportchange`, and `mapresize` events. `destroy()` releases browser resources; operations after destruction throw.

`setMarkers()` reconciles by stable marker `id`: retained markers keep their DOM nodes, focus, and in-progress entrance animations; only new IDs animate in. Identical ordered marker updates are a visual no-op. Camera state and `viewportchange` events remain synchronous, while animated camera steps and their dependent label/marker layout commit in the same browser frame.

For a small guide, import `guideMapData` from `/guide/data` and pass it to `createMap`. The optional `/guide` entry also provides `createGuideMap`, `mountGuideMap`, and detailed-data loading for existing guide layouts. `/transit` provides the standalone schematic transit animation. See [examples](docs/EXAMPLES.md) and [consumer integration](docs/consumer-integration.md).

For the guide preset with the same controller API, use `createGuideController(options)` from `/guide` (or `/guide/map`). It accepts grouped `MapOptions` and returns `MapController`; `mountGuideController(shell, options)` enhances a `createGuideShell()` container. Both use the lightweight guide geography. Existing `createGuideMap` and `mountGuideMap` calls retain their element-based API.

Two opt-in features animate the map's lines and layers. `features.layerTransitions` fades layers as `configure({ layers })` and `setMode()` switch them, crossfades neighborhood boundaries when `setSource()` changes the definition, and crossfades district fills on `setDistrictStyle()`. `features.districtMorph` moves district outlines from one map year to the next on `setDistrictYear()`, then settles on the exact published geometry; pass `{ animate: false }` for an instant change. Both default off, own and cancel their animations, and yield to reduced motion.

District style callbacks are evaluated once per district at construction and on style or year updates. Hover, selection, and layer toggles reuse the prepared styles; call `setDistrictStyle()` again when external styling data changes. Invalid styles leave the current map unchanged. District fades respect reduced motion and are removed on interruption or destruction.

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
