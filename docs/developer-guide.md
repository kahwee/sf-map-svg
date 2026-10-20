# Developer guide

Choose the renderer and geography separately. `renderMap` produces a string without a DOM; `createMap` produces a browser controller whose `.element` you mount. Neither root function imports geography for you.

## Choose an entry point

| Task | Renderer | Data |
| --- | --- | --- |
| Generate an SVG file or server-rendered image | `/static`: `renderMap` | `/data/static`: `staticMapData` |
| Explore districts or several neighborhood definitions | `/map`: `createMap` | `/data/full`: `fullMapData` |
| Embed a smaller neighborhood guide | `/guide/map`: `createGuideController` | Included lightweight guide geography |
| Use the guide data with the general controller | `/map`: `createMap` | `/guide/data`: `guideMapData` |
| Query bounds or polygon containment without a DOM | `/geometry` | Caller-supplied geometry or explicit dataset imports |
| Look up names without mounting a map | `/data/lookup` | Source-aware lookup helpers |

Imports starting with `/` in this table are package suffixes, such as `@kahwee/sf-map-svg/static`. Node 24+ is required for server rendering. Browser examples need a DOM and a bundler that supports JSON modules. This is an ESM package.

## Write a static SVG

```ts
import { writeFile } from 'node:fs/promises';
import { renderMap } from '@kahwee/sf-map-svg/static';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';

const { svg } = renderMap(staticMapData, {
  year: 2022,
  landmarks: true,
  bartStations: true,
  title: 'San Francisco districts, 2022',
});
await writeFile('san-francisco.svg', svg);
```

The SVG is self-contained. `project([lng, lat])` returns SVG coordinates; `viewBox` is `[0, 0, width, height]`. Use a different `idPrefix` for each inline SVG on the same page, or let the renderer generate one.

## Mount and dispose an interactive map

Provide a host such as `<div id="map"></div>` before running this code. Run browser construction after mounting, not during server rendering.

```ts
import { createMap } from '@kahwee/sf-map-svg/map';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const host = document.querySelector<HTMLElement>('#map');
if (!host) throw new Error('Missing #map host');

const map = createMap(fullMapData, {
  mode: 'neighborhoods',
  source: 'realtor',
  layers: { bartStations: true },
  features: { motion: true },
  appearance: { theme: 'districts' },
});
host.append(map.element);
const unsubscribe = map.on('neighborhoodchange', ({ name }) => {
  // name is null when the selection is cleared.
  console.log(name);
});

// Call from your framework's unmount hook or when removing the view.
function disposeMap() {
  unsubscribe();
  map.destroy();
  map.element.remove();
}
```

`destroy()` is idempotent, cancels owned work and subscriptions, and leaves host-owned DOM in place. Other controller operations after destruction throw. In React, construct inside an effect and return cleanup; in Vue or Svelte, use their mount/unmount hooks. Do not create a new map on every render: update the existing controller instead.

## Know the defaults

| Setting | `renderMap` | `createMap` |
| --- | --- | --- |
| Mode | No mode option | `basemap`; set `neighborhoods` or `districts` explicitly |
| Theme | `districts` | `transit`; use `appearance.theme` |
| District layers | On | Follow `districts` mode |
| Neighborhood layers | Lines off | Follow `neighborhoods` mode |
| Parks, highways, key roads | Off | On when supplied |
| Road labels | Follow `keyRoads` | On when supplied, subject to zoom/collisions |
| BART stations | Off | On when supplied |
| Visible labels | On | On, subject to zoom/collisions |
| Motion features | Static animation off | Off; opt in via `features` |

A layer switch does not download missing geography. `fullMapData` has `.map` for static rendering and separate lookup collections for interactive use. `staticMapData` is already a static data object. Use `renderMap(guideMapData, options)` or `renderMap(fullMapData, { source: 'sf-find' })` to share source-aware geography with the browser controller. Passing `.map` remains supported as compact static geography; it already chooses its neighborhoods and does not accept a `source` option.

SFAR realtor neighborhoods are the default when supplied. If only an alternative collection is supplied, the controller selects that available source. Choose `source` explicitly when comparing definitions. Sources retain separate identities; they are not interchangeable polygons.

## Construction settings versus runtime updates

| Change | Call |
| --- | --- |
| Presentation, layers, controls, behaviors | `map.configure({ layers, controls, features, appearance, mode, source, year, labels })` |
| Map mode or neighborhood source | `map.setMode(mode)`, `map.setSource(source)` |
| District boundaries or choropleth | `map.setDistrictYear(year)`, `map.setDistrictStyle(callback)` |
| Master text visibility | `map.setLabels(visible)` |
| Markers or route overlays | `map.setMarkers(items)`, `map.setOverlays(items)` |
| Camera | `map.camera.set/pan/zoom/fit/reset(...)` |
| Palette, typography, control styling | `map.configure({ appearance })`; retains camera, selection and focus |

Controller patches merge nested token and feature records. Omitted and `undefined`
values retain existing values. Use `false` to disable a boolean switch and
`resetConfiguration()` to clear presentation overrides explicitly:

```ts
map.configure({ layers: { neighborhoodLabels: false } });
map.configure({ features: { motion: false } });
map.resetConfiguration(['layers']); // follow mode-derived defaults again
map.resetConfiguration(['appearance']); // built-in palette and typography
```

Reset groups are `features`, `layers`, `controls`, and `appearance`; omitting
the argument resets all four. Resets preserve geographic choices and camera,
and do not restore constructor overrides. Static maps accept grouped layers and
the shared appearance keys (`theme`, `colors`, `districtStyle`) at construction.
See [the API contract](API.md#live-configuration-and-inspection).

`getConfiguration()` returns a detached snapshot of geographic choices and
presentation overrides. Use `getResolvedConfiguration()` for effective layers
and `getCapabilities()` for supplied geography. Invalid patches preserve state.
`setMode`, `setSource`, and `configure` all preserve the camera; request movement
with `camera.reset()` or `camera.fit(geometry)`. See the
[v5 migration guide](migration-v5.md) for changed call forms.

## Geographic queries

The v5 `/geometry` helpers `geometryBounds(geometry)` and
`geometryContainsPoint(geometry, position)` work without a DOM or bundled
geography. Import `Bounds`, `Geometry`, and `Position` types from the same entry.
Use containment for area lookup and bounds for geographic extents; pass the
original geometry to `camera.fit`, rather than geographic bounds to `camera.set`.
See the [worked example](EXAMPLES.md#find-areas-containing-a-location) and
[full query semantics](API.md#geographic-queries).

## Markers, routes and camera coordinates

Markers use `position: [longitude, latitude]`. GeoJSON coordinates and the static projection use `[longitude, latitude]`, in WGS84. Camera viewports use `[x, y, size]` in the fixed 800 × 800 projected map space; they are not geographic bounds. `camera.pan` takes deltas in CSS pixels and converts them using the mounted canvas width. `projectToScreen([lng, lat])` returns CSS pixels relative to the map canvas, plus viewport visibility. The former two-number call is removed in v5.

Marker and overlay IDs must be unique. Keep marker IDs stable across updates so retained markers preserve DOM nodes, focus and entrance animations. Use `null` to clear a selection; selection methods return a boolean. Selection events can contain null values. `map.on()` returns an unsubscribe function.

Reduced motion takes precedence over animations. Map touch gestures are opt-in; hiding a chooser requires an accessible alternative in your application.

## Common integration errors

| Symptom | Check |
| --- | --- |
| No neighborhoods or district fills | Set `mode` explicitly; the default is `basemap` |
| An enabled layer does not appear | Supply its dataset; check master labels, zoom and collision filtering |
| A theme or motion option throws | Put styling in `appearance` and behaviors in `features`; flat interactive options are rejected |
| Source switch throws | Supply that source collection, or use `/data/full` |
| A geographic coordinate produces a surprising camera view | Use `camera.fit(geometry)`; `camera.set` takes projected coordinates |
| An event handler breaks after clearing selection | Handle null `id`, `name`, `marker`, or `district` |
| Updates throw after navigating away | Dispose once and stop calling the destroyed controller |
| An import from `/legacy`, `/custom-map`, `/explorer`, `/interactive` or `/interactive-data` fails | Those entries were removed in v3; follow the migration guide |

## Versions and assistant-readable docs

The package declarations are the exact type contract for your installed version. Check the changelog before using features shown on a local preview: its Unreleased section can include functionality absent from npm.

The generated `llms.txt` index links to Markdown documentation; `llms-full.txt` combines the guides and type contracts into one file. Both are built from the same package selected for the site. Local previews are labeled as working-tree docs. Released builds use the installed npm package's docs and declarations.

See [API options](API.md), [worked examples](EXAMPLES.md), [consumer integration](consumer-integration.md), and [v3 migration](migration-v3.md).
