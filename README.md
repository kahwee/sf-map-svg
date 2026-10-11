# SF Map SVG

Offline, self-contained San Francisco SVG maps. The package has no runtime dependencies. Geography is always an explicit import; the root entry does not bundle data.

[Getting started](docs/developer-guide.md) · [API reference](docs/API.md) · [Design playground](https://kahwee.github.io/sf-map-svg/playground.html) · [Live examples](https://kahwee.github.io/sf-map-svg/examples.html) · [Storybook source](stories/) · [Geographic sources](SOURCES.md) · [v3 migration](docs/migration-v3.md)

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
const host = document.querySelector('#map');
if (!host) throw new Error('Missing #map container');
host.append(map.element);
map.on('neighborhoodchange', ({ name }) => console.log(name));
map.camera.zoom(1.5);
// Call when your application removes this view.
function disposeMap() {
  map.destroy();
  map.element.remove();
}
```

`createMap(data, options)` returns a controller. Use `map.element` for mounting, `map.configure({ features, layers, controls, appearance, mode, source, year, labels })` for runtime switches, `map.camera` for pan/zoom/fit/reset, and `map.on()` for typed events. Appearance can change live while preserving camera, selection, and focus. `getResolvedConfiguration()` explains effective layers; `getCapabilities()` reports supplied geography. SFAR realtor neighborhoods are the default when supplied; SF Find and analysis are explicit alternate sources. The `/data/full` preset includes all three collections and historical districts.

See [controller options, events, and lifecycle](docs/API.md#interactive-maps),
[examples](docs/EXAMPLES.md), and [consumer integration](docs/consumer-integration.md).
Call `destroy()` when removing an interactive map.

## Documentation for coding assistants

[Developer guide](docs/developer-guide.md) · [llms.txt index](llms.txt) · [Complete text documentation](llms-full.txt). Generated from project docs and TypeScript declarations; run `pnpm docs:llms` after changing those inputs.

## Data and development

Canonical geography is in [`data/`](data/README.md), with provenance in [`SOURCES.md`](SOURCES.md). The public `/data` entry exposes lookup, catalog, district maps, and source-specific neighborhood collections. These are deeply frozen; clone before editing.

Install with `pnpm install --frozen-lockfile`. See the [contributing guide](CONTRIBUTING.md) for architecture and the [validation and release runbook](https://github.com/kahwee/sf-map-svg/blob/main/docs/maintenance.md) for checks, browser inspection, and publishing. If you are upgrading from v2, follow the [v3 migration guide](docs/migration-v3.md).

## Browser checks and marker performance

The focused interaction suite checks a production bundle in Chromium, Firefox, and WebKit at 1440 px and 390 px. It covers overlapping-place selection, marker keyboard navigation and focus recovery, camera input, resizing, touch-mode scroll policy, reduced motion, and disposal. Phone widths check responsive layout in these engines; they do not replace physical-device gesture testing. The full Storybook and screenshot suites continue to use Chromium.

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:browsers
pnpm benchmark:markers --browsers=chromium,firefox,webkit
```

The benchmark uses headless engines and a deterministic city grid with 500 and 2,000 labeled markers at 800 px and 390 px viewport widths. It loads the production bundle and fonts before timing, disables motion, and starts each operation from a consistent camera and clustering state. Each operation has three warmups and 20 measured samples. Results include mount, pan, zoom, clustering changes, retained-ID updates, replacement, and identical updates. Run benchmarks alone on an otherwise idle machine. Use `--labels=false` to compare label cost and `--output=test-results/another-run.json` to keep separate results.

`test-results/marker-benchmark.json` records browser versions, machine details, and p50/p95/max timings. Synchronous times include the API call and forced layout; settled times include two animation frames and are not GPU-paint measurements. A separate 60-frame pan run records frame intervals. These measurements describe the test machine, rather than a universal performance limit or a mobile-device guarantee. CI saves a shorter 2,000-marker Chromium benchmark for comparison without timing thresholds.

Measured October 10–11, 2026 against renderer commit `1d523d9`, in a Linux x64 container on an Intel Xeon Platinum 8573C with a four-CPU quota and 16 GiB memory limit, using Node 26.11.1 and Playwright 1.63.0. All 36 focused browser checks passed. The 2,000-marker results below use clustering and labels. Mount, update (retained IDs), and replacement (all new IDs) show median synchronous milliseconds; pan shows the 95th-percentile frame interval in milliseconds.

| Engine | Viewport | Mount | Update | Replace | Pan frame p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium 153 | 800 px | 147.2 | 28.3 | 92.0 | 166.7 |
| Chromium 153 | 390 px | 180.6 | 24.4 | 104.4 | 183.3 |
| Firefox 155 | 800 px | 351.0 | 55.0 | 222.0 | 200.3 |
| Firefox 155 | 390 px | 386.0 | 211.0 | 161.0 | 116.8 |
| WebKit 26.6 | 800 px | 468.0 | 105.0 | 896.0 | 302.0 |
| WebKit 26.6 | 390 px | 235.0 | 107.0 | 889.0 | 118.0 |

Dense marker sets need further rendering work: these frame intervals exceed the 16.7 ms budget for 60 Hz interaction. Clustering groups symbols while retaining the supplied marker nodes. Prefer smaller marker lists and stable IDs, and avoid repeatedly replacing every marker during interaction. Identical 2,000-marker updates took 0.7–2.0 ms at the median across these runs; full replacement was especially costly in WebKit. Keep camera-call timings separate from frame timings: a quick synchronous call does not imply a smooth rendered frame.

A separate 20-sample Chromium run with 2,000 markers at 800 px and `labels: false` reduced the pan frame p95 from 166.7 ms to 50.0 ms and median mount time from 147.2 ms to 115.6 ms. Disabling labels helps this workload but still does not establish 60 Hz performance. Reproduce the comparison with `pnpm benchmark:markers --counts=2000 --widths=800 --labels=false --output=test-results/marker-benchmark-no-labels.json`.

## CI maintenance

[GitHub Actions maintenance](.github/ACTIONS.md) covers workflows, parallel checks, action versions, and weekly updates.
