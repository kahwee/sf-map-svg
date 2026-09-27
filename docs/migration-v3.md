# Migrate to version 3

Version 3 removes the deprecated compatibility entry points and their bundled-data factories. This is a breaking major release. Version 2 remains available if you need time to migrate; removed imports fail to resolve in version 3. The root API introduced in version 2 remains the supported API.

| Version 2 import or call | Version 3 replacement |
| --- | --- |
| `/legacy` `renderSFMap(options)` | `renderMap(staticMapData, options).svg` |
| `/legacy` `createSFMap(options)` | `renderMap(staticMapData, options)` |
| `/custom-map` `createSFMapWithData(options, data)` | `renderMap(data, options)` |
| `/explorer` `createNeighborhoodExplorer(options)` | `createMap(fullMapData, options)`; mount `.element` |
| `/interactive` `createInteractiveSFMap(options)` | `createMap(fullMapData, { mode: 'basemap', ...options })`; mount `.element` |
| `/interactive-data` `createInteractiveSFMapWithData(data, options)` | `createMap(data, options)`; mount `.element` |

`staticMapData` comes from `@kahwee/sf-map-svg/data/static` and includes the complete static map. `fullMapData` comes from `/data/full` and adds the interactive lookup collections. For smaller bundles, construct data from individual `/data/*` modules or use `guideMapData` from `/guide/data`. There is no implicit geographic data in the root import.

```ts
import { createMap, renderMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const svg = renderMap(fullMapData.map, { landmarks: true }).svg;
const map = createMap(fullMapData, { mode: 'neighborhoods' });
document.querySelector('#map')?.append(map.element);
map.camera.zoom(2);
map.configure({ layers: { landmarks: false } });
map.destroy();
```

The controller owns subscriptions and cleanup. Replace old element calls with controller methods (`camera.get/set/pan/zoom/reset/fit/stop`, `selectNeighborhood`, `setSource`, `setMode`, `setLabels`, `setMarkers`, and `setOverlays`). Group feature flags under `features` and styling under `appearance`; `configure` updates runtime features, layers, and controls. For code that needs the guide shell, `/guide`, `/guide/data`, `/guide/static`, and `/guide/map` remain supported. `/transit` also remains supported.

Review tree-shaking after migrating: `/data/full` intentionally includes every packaged layer, while the root and `/static` stay data free. Test server rendering, browser mounting, and map disposal in your application before upgrading production.
