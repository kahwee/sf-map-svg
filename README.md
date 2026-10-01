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

See [map options and animations](docs/API.md#static-maps) for optional layers and static animation.

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

See [controller options, events, and lifecycle](docs/API.md#interactive-maps),
[examples](docs/EXAMPLES.md), and [consumer integration](docs/consumer-integration.md).
Call `destroy()` when removing an interactive map.

## Documentation for coding assistants

[Developer guide](docs/developer-guide.md) · [llms.txt index](llms.txt) · [Complete text documentation](llms-full.txt). Generated from project docs and TypeScript declarations; run `pnpm docs:llms` after changing those inputs.

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

The [contributing guide](CONTRIBUTING.md) explains the geographic and release checks. If you are upgrading from v2, follow the [v3 migration guide](docs/migration-v3.md).
