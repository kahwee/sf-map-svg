# Version 2: data, configuration and lifecycle boundaries

Version 2 changes the root export. Geography is an explicit dependency, rather than
an accidental consequence of importing a renderer. The new `createMap` returns a
controller with `element` and `camera`; consumers no longer need an extended DOM
node as their application API. The existing renderer engine stays shared, preserving
its visual defaults and the established browser regression coverage.

## Choose your migration path

Install `@kahwee/sf-map-svg@2.0.0`. You can migrate in two steps:

1. **Keep your existing map working:** change old root imports to `/legacy`.
   Existing `/guide`, `/interactive`, `/interactive-data`, `/explorer`, `/custom-map`,
   `/transit`, and data subpaths remain available. No controller rewrite is required
   just to adopt 2.0.0 through these compatibility paths.
2. **Adopt the v2 API:** choose explicit data, group options, mount `map.element`,
   move camera calls to `map.camera`, and register events with `map.on()`.

Unknown configuration keys, malformed values, duplicate marker/overlay IDs and
mutation of frozen preset data are no longer tolerated. These validation changes
also affect compatibility renderers where the shared engine applies them. Remove
app-only fields from options (keep them in your own state), correct misspellings,
and use `structuredClone(guideMapData)` before deriving a custom dataset.

### Smallest change for an existing static map

Before (v1):

```js
import { renderSFMap } from '@kahwee/sf-map-svg';
const svg = renderSFMap({ landmarks: true });
```

After (v2 compatibility, same full dataset and result):

```js
import { renderSFMap } from '@kahwee/sf-map-svg/legacy';
const svg = renderSFMap({ landmarks: true });
```

Also move `createSFMap`, `districtColors`, `districtYears`, `neighborhoodNames`,
`DistrictYear`, and `SFMapOptions` root imports to `/legacy`. `MapMarker` and
`MapOverlay` types remain available at the v2 root. The new static options type is
named `StaticMapOptions`.

To explicitly choose smaller overview data (a deliberate detail change):

```js
import { renderMap } from '@kahwee/sf-map-svg/static';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';
const { svg, project } = renderMap(guideMapData.map, {
  theme: 'transit',
  districtFills: false,
  districtLines: false,
  districtLabels: false,
  landmarks: true,
  neighborhoodLines: true,
});
```

`renderMap` returns an object containing `svg` and projection helpers; it does not
return the markup string directly. It takes **data first, options second**, unlike
legacy `createSFMapWithData(options, data)` on `/custom-map`.

### Complete interactive guide migration

Both examples expect `<div id="map"></div>` in the page and a bundler with JSON
import support. Call the shown cleanup function when your component unmounts.

Before (v1):

```js
import { createGuideMap } from '@kahwee/sf-map-svg/guide';
const places = [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park' }];
const map = createGuideMap({
  markers: places,
  layers: { roadLabels: false },
  controls: { pan: false },
});
document.querySelector('#map').append(map);
const selected = event => console.log(event.detail.marker?.id);
map.addEventListener('markerchange', selected);
map.selectMarker('dolores');
const saved = map.getViewport();
map.setViewport(saved);
const cleanup = () => {
  map.removeEventListener('markerchange', selected);
  map.destroy();
  map.remove();
};
```

After (v2 controller, with optional motion):

```js
import { createMap } from '@kahwee/sf-map-svg';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';
import { guideOptions } from '@kahwee/sf-map-svg/presets';
const places = [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park' }];
const map = createMap(guideMapData, {
  ...guideOptions,
  markers: places,
  // Merge the preset's layer group; a shallow top-level spread replaces it.
  layers: { ...guideOptions.layers, roadLabels: false },
  controls: { pan: false },
  features: { motion: { duration: 400 }, markerEntrance: true },
});
document.querySelector('#map').append(map.element);
const unsubscribe = map.on('markerchange', ({ marker }) => console.log(marker?.id));
map.selectMarker('dolores');
const saved = map.camera.get();
map.camera.set(saved, { animate: false });
map.configure({ features: { motion: false }, controls: { pan: true } });
const cleanup = () => {
  map.destroy(); // Also removes subscriptions created through on().
  map.element.remove();
};
// unsubscribe() can remove this one subscription earlier; it is idempotent.
```

Do not spread unconverted v1 options directly into `createMap`: colors/theme and
other style fields move into `appearance`, while new opt-in behavior lives under
`features`. Motion, entrance, ring and clustering options are new in this release;
references below to their flat form describe the **v2 compatibility API**, not
features that existed in the published v1 package.

### Data types and bundle ownership

`StaticMapData` is the coast plus optional district rows, parks, roads, stations and
neighborhood geometry consumed by `renderMap`. `MapData` wraps that as `map` and adds
source-aware `neighborhoods` collections and optional interactive `districts`.
Use `renderMap(guideMapData.map, options)` for static SVG and
`createMap(guideMapData, options)` for the browser controller. Do not interchange
these two shapes. Data is borrowed for the map lifetime; treat supplied collections
as immutable. A coast-only controller can pass `{ map: { coast }, neighborhoods: {} }`.

## Migration

| Version 1 or compatibility API | Version 2 |
| --- | --- |
| Root `renderSFMap(options)` | `renderMap(data, options).svg`; or move the old import to `/legacy` |
| Root `createSFMap(options)` | `renderMap(data, options)`; or `/legacy` |
| `createGuideMap(options)` | `createMap(guideMapData, options)` with the preset and explicit layer merge shown below |
| `host.append(map)` | `host.append(map.element)` |
| Top-level `motion`, `clustering`, entrances, rings, furniture | `features: { ... }` |
| Top-level colors, theme, typography, area/marker styling, chrome tokens | `appearance: { ... }` |
| `setFeatures`, `setLayers`, `setControls` | `configure({ features, layers, controls })` |
| `getFeatures()` | `getConfiguration().features` |
| `setViewport`, `getViewport`, `resetView`, `zoomBy`, `panBy`, `stopAnimation` | `camera.set`, `.get`, `.reset`, `.zoom`, `.pan`, `.stop` |
| `fitGeometry(geometry, padding, motion)` | `camera.fit(geometry, { padding, ...motion })` |
| `addEventListener('markerchange', e => e.detail)` | `on('markerchange', detail => ...)` returns unsubscribe |
| `onMarkerActivate` / `onOverlayActivate` options | `on('markerchange', ...)` / `on('overlayactivate', ...)`; markerchange also reports clearing |
| `getSelection()` | `getSelectedNeighborhood()`; `getSelectedMarker()` remains distinct |
| Calls after destroy silently ignored | Controller operations throw; repeated `destroy()` and unsubscribe are safe |

`on()` supports markerchange, neighborhoodchange, overlayactivate, clusteractivate,
viewportchange, and mapresize. Each listener receives a detached detail snapshot;
mapresize has undefined detail. Browser-native events still belong on `map.element`. V2 overlays are activatable
buttons (mouse and keyboard), whether or not a listener is registered; provide a
meaningful `label`. Static overlays remain presentation-only.
Do not access the compatibility methods that happen to exist on its underlying DOM
implementation: they are not part of the v2 controller contract.

For the full sidebar explorer or compact progressive shell, existing `/explorer`
and `/guide/map` APIs remain supported. They keep their established element return
value and options. Their names do not silently change meaning in this major version.
This staged migration avoids forcing a host to rebuild working SSR shell integration.

## One configuration boundary

Construction and `configure()` use the same `features`, `layers`, and `controls`
groups. All groups in a patch are validated before mutation. Updating controls does
not restart marker entrances or cancel an in-progress camera move. Setting a motion
option deliberately cancels the old camera timeline.

- Omitted groups and keys retain their values.
- `false` disables a feature/switch.
- An explicit undefined key resets that key to its default.
- An undefined group resets that entire group.
- Nested feature objects replace; they do not deep-merge.
- `getConfiguration()` returns detached normalized features and explicit layer/control
  overrides. Missing overrides continue to follow mode/library defaults.

Appearance is immutable configuration for one instance. Markers, overlays, source,
mode, labels and selection have explicit methods; they are not silently mixed into
configuration patches. This keeps a change of visual controls from triggering
geographic replacement or camera movement. Defaults remain stable and motion remains
opt-in; reduced motion always overrides application choices.

`destroy()` removes owned subscriptions and cancels runtime work. It leaves the DOM
in place so the host framework can unmount it; it cannot dispose application-owned
listeners or arbitrary callout resources. All controller operations, including reads
and new subscriptions, throw after disposal. The `destroyed` flag and element references
remain readable for cleanup.

## Bundle contract

| Entry | Runtime | Geographic data |
| --- | --- | --- |
| root / `/map` | Controller and browser renderer | None |
| `/static` | SVG renderer only | None |
| `/presets` | Small immutable configuration | None |
| `/guide/data` | Immutable overview dataset | Selected SFAR/parks/roads/BART/coast |
| `/guide/detailed` | Explicit asynchronous loader | Detailed data in lazy chunks |
| `/legacy`, `/interactive`, `/explorer` | Compatibility renderer | Broad bundled datasets |

Use named imports. The production bundle test imports `renderMap` from the root
and verifies that tree shaking removes the browser runtime. It also rejects any
geographic JSON in the v2 renderer graph and enforces 35 KiB gzip for the root and
10 KiB for the static consumer. The guide data budget remains separately enforced.

Optional feature *behavior* can be switched at runtime; that does not mean each
feature's implementation disappears from the renderer bundle. Geography dominates
size, so explicit dataset imports and separately cached, versioned assets are the
first optimization. A generic plugin registration framework would add lifecycle
complexity without a demonstrated size benefit; the internal camera, clustering,
configuration and validation modules already provide testable boundaries for a later
code-split feature if measurements justify it.

Never import the compatibility barrel merely to obtain one dataset. Keep static
rendering on the server/build side. Load browser code when needed, and request detail
only on demand. See the measured [bundle report](guide-bundle-report.md) and
[consumer guide](consumer-integration.md).

## Compatibility and testing

The v2 root is intentionally breaking; the package metadata is 2.0.0. The old root
is available under `/legacy`. Existing named subpaths continue to work, while new
examples exercise the controller. Node configuration tests, browser stories, packed
consumer declaration checks, and production import-graph checks cover the new
boundary. No runtime dependency or geographic data change is introduced.

A minimal browser basemap can supply `{ map: { coast }, neighborhoods: {} }`.
Neighborhood and district modes require their respective datasets; requesting a
missing mode/source fails without changing the live map. With a single alternative
neighborhood source and no explicit `source`, the renderer chooses the available
source. SFAR remains the default whenever it is supplied.
