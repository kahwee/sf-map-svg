# San Francisco SVG maps

![District fills, optional neighborhood boundaries, and plain outlines](docs/map-preview.png)

An MIT-licensed package extracted from KahWee’s **San Francisco District Map** Site. Draws a self-contained SVG with bundled geometry and no runtime dependencies, tiles, WebGL, or network requests.

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
| `theme` | `'districts'` | Use `'transit'` for pale blue water, ivory land, green parks, and blue BART symbols; custom `colors` still take precedence |
| `districtFills`     | `true`              | Original Site’s eleven muted district colors                                                                               |
| `labels` | `true` | Master switch for visible map text; symbols and accessible titles remain |
| `districtLabels`    | `true`              | District number badges                                                                                                     |
| `highways`          | `false`             | Original Site’s highway geometry                                                                                           |
| `landmarks`         | `false`             | Golden Gate Park, Presidio, Lincoln Park, Twin Peaks, Dolores Park, and McLaren Park                                       |
| `bartStations`      | `false`             | Eight San Francisco BART stations with blue rings and names                                                                |
| `width`, `height`   | `800`, `800`        | SVG viewBox and intrinsic size                                                                                             |
| `padding`           | `28`                | Space around the coast                                                                                                     |
| `markers`           | `[]`                | Points with `id`, `lng`, `lat`, optional `label`, `color`, `selected`                                                      |
| `keyRoads` | `false` | Nine selected road corridors and names for orientation |
| `colors`            | Built-in palette    | Override `water`, `land`, `district`, `neighborhood`, `highway`, `road`, `park`, `landmark`, `bart`, `label`, `marker`, `selected` |
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

The `theme: 'transit'` preset borrows the clear visual hierarchy of [BART’s system map](https://www.bart.gov/system-map), retaining geographic positions. It uses a quiet, single-color land fill instead of district colors. The neighborhood explorer uses this preset.

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


## TypeScript development

The library is authored in strict TypeScript 7. Run `pnpm build` to compile JavaScript and declarations into `dist/`. JavaScript consumers require no TypeScript runtime. `pnpm format` applies Biome formatting and safe lint fixes; `pnpm check` checks Biome, data, source and consumer types, and tests.

Enable `keyRoads: true` for Market, Mission, Geary, Van Ness, 19th Avenue, Sunset, The Embarcadero, Columbus, and Divisadero. These use active DataSF centerlines, not invented routes. The explorer reveals road names as you zoom. Import `keyRoads` from the data entry point or `data/key-roads.json` for geometry, source segment IDs, and label anchors.

### Map modes and labels

The interactive explorer includes a map-mode selector and a Labels toggle. `mode: 'districts'` shows numbered supervisorial districts; `mode: 'neighborhoods'` shows names from the selected neighborhood source (SFAR realtor by default). Labels are collision-filtered and remain about 12 screen pixels through map zoom and resize; more names fit as you zoom in. Road labels use 11 pixels.

```js
const explorer = createNeighborhoodExplorer({ mode: 'districts', labels: true });
explorer.setLabels(false);
explorer.setMode('neighborhoods');
explorer.setLabels(true);
```

`renderSFMap({ labels: false })` also hides all visible text while retaining station symbols and accessible titles. Standalone SVGs are static images; the interactive explorer provides the constant-size labels during map zoom.

## Reusable interactive map

The new `@kahwee/sf-map-svg/interactive` entry point provides a map, accessible controls, and
attribution without the explorer's search sidebar or detail panel. It does not change URLs,
load articles, apply editorial filters, or navigate. Importing the static entry point does not
import this interactive runtime. Both paths retain zero runtime dependencies.

```js
import { createInteractiveSFMap } from '@kahwee/sf-map-svg/interactive';

const map = createInteractiveSFMap({
  mode: 'neighborhoods',
  source: 'analysis', // 'sf-find' and 'realtor' are also available
  theme: 'transit',
  labelSize: { min: 12, max: 15 },
  layers: { districtFills: false, districtLines: false, districtLabels: false },
});
document.querySelector('#map').append(map);
map.addEventListener('neighborhoodchange', ({ detail }) => {
  // On clear: id, name, and feature are null. source always identifies the dataset.
  console.log(detail.id, detail.name, detail.source);
});
map.selectNeighborhood('Mission', { fit: false });
const selection = map.getSelection(); // { id, name, source, feature } or null
map.selectNeighborhood(null);
```

`createInteractiveSFMap()` defaults to `mode: 'basemap'`: no district or neighborhood layers.
Parks, roads, and stations are initially enabled and can be disabled independently. The existing
`createNeighborhoodExplorer()` and static APIs retain their realtor/district defaults. The
source option only chooses a definition collection; it does not make that collection visible
in basemap mode. Editorial groupings belong to the consumer and are never treated as geographic
aliases. Import types including `InteractiveSFMapOptions`, `InteractiveSFMapElement`,
`MapViewport`, `MapPadding`, and `NeighborhoodSelection` from the interactive entry point.

| Option | Default | Behavior |
| --- | --- | --- |
| `mode` | `basemap` (interactive), `neighborhoods` (explorer) | `basemap`, `districts`, or `neighborhoods`; establishes layer defaults |
| `source` | `realtor` | `realtor`, `sf-find`, or `analysis`; explicit source recommended for reusable integrations |
| `theme` | `transit` | `transit` or `districts` |
| `year` | `2022` | District vintage: 2002, 2012, or 2022 |
| `layers` | Mode defaults | Independent booleans: `districtFills`, `districtLines`, `districtLabels`, `neighborhoodLines`, `neighborhoodLabels`, `landmarks`, `bartStations`, `highways`, `keyRoads` |
| `labels` | `true` | Master visible-text switch; accessible descriptions and station symbols remain |
| `labelSize` | `{ min: 11, max: 12 }` | Screen-pixel range, 8–32 allowed. Nominal sizes are 11 for roads and 12 otherwise, clamped to this range; sizes never grow with zoom |
| `selectableNeighborhoods` | `true` | Enables pointer/keyboard selection; false retains geography and labels |
| `neighborhood` | Unset | Initial name, alias, or ID in the selected source |
| `fitPadding` | `24` | Screen pixels, number or `{ top, right, bottom, left }`, used by selection and geometry fitting after mounting |
| `markers` | `[]` | Supplied `MapMarker` records with unique, nonempty IDs; no content fetching |
| `markerRadius` / `markerHitSize` | `6` / `44` | Screen-pixel visible radius and tap-target diameter, independent of zoom; selected radius grows by 2px |
| `markerColor` / `selectedMarkerColor` | `#245b61` / `#f04f32` | Default marker colors; individual `marker.color` overrides the unselected color |
| `onMarkerActivate` | Unset | Called when a non-null marker selection changes, including programmatic changes |

Explicit layer options override mode defaults even after `setMode()`. District fills, outlines,
and badges can therefore be composed with neighborhood names without requiring district
labels. Descriptions identify only displayed boundary layers, their source and available
vintage; analysis data is described as census-tract-based reporting areas, without inventing a
boundary year. The downloadable source metadata remains available in the full explorer.

Labels use measured screen-space collision boxes. Selected marker and neighborhood names
come first, then district labels, stations, parks, roads, and neighborhoods in descending area
order with stable ID tie-breaking. Station and marker symbols reserve space. Roads and station
names appear at 1.8× zoom; city view keeps park labels sparse. Labels outside the viewport or
without room are suppressed, including a selected label too wide to fit. Selection names remain
available in the native chooser and through events. The label range is separate from SVG user
units used by the static renderer.

### Viewport and controlled selection

```js
const saved = map.getViewport(); // copied [x, y, size] in the 800×800 projected map
map.zoomBy(2);
map.panBy(30, 0); // move view east by 30 screen pixels
map.setViewport(saved);
map.resetView();
map.fitGeometry({
  type: 'MultiPoint',
  coordinates: places.map(({ lng, lat }) => [lng, lat]),
}, { top: 24, right: 24, bottom: 80, left: 24 });
map.addEventListener('viewportchange', ({ detail }) => saveInYourState(detail.viewport));
```

Call `fitGeometry` after mounting in a visible container. It accepts WGS84 GeoJSON geometry,
including `Point`, `MultiPoint`, and `GeometryCollection`, and rejects empty geometry or
impossible padding. Views are constrained to the city extent and 1–12× zoom. Consequently,
padding is best-effort near city edges or for extents larger than the map; a single point fits
at maximum zoom. This is an SF map, not a world map. Resizing keeps the projected view and
recomputes screen sizes; call `fitGeometry` again if a new container size needs different fitting.
Initial neighborhood fitting before mounting uses the explorer's proportional padding.

`selectNeighborhood(nameOrIdOrNull, { fit: false })` and `selectMarker(idOrNull, { fit: false })`
allow external state to drive selection without moving the viewport. They return false for
unknown identities. `getSelection()` and `getSelectedMarker()` read current selection.
`setSource(source)` clears neighborhood selection and resets the view, emitting a clear event
when needed. `setMode(mode)` resets the viewport. Repeating the same viewport or selection
emits no change event, avoiding state feedback loops. All events bubble. Call `destroy()`
before removing the element to release listeners, observers, frames, and download URLs.

### Dense markers

```js
const map = createInteractiveSFMap({ markers: places });
document.querySelector('#map').append(map);
map.addEventListener('markerchange', ({ detail }) => {
  // { id, marker }, both null when cleared. Render your own content panel here.
  renderSelection(detail.marker);
});
map.setMarkers(updatedPlaces);
map.selectMarker('place-id');
```

Every supplied marker remains in the native chooser, even when positions coincide or markers
are outside the current view. Pointer and keyboard activation select and fit a marker; markers
also have individual keyboard stops. This is the accessible-choice alternative to clustering:
no counts are estimated and no supplied markers are silently dropped. The chooser count is
the supplied collection size. Replacing markers retains the selected ID when present, otherwise
uses an explicitly selected marker or clears selection. Large hit targets can overlap; use the
chooser to reach obscured markers. Automated clustering is not included in this release.

### Gesture policy and keyboard access

- **Default touch:** one finger scrolls the page; pinch zooms the browser. Map buttons and
  native choosers work without engaging map gestures.
- **Touch navigation:** explicitly enable the visible button (or `setTouchNavigation(true)`).
  One finger pans the map; two fingers pan and pinch around their midpoint. The button becomes
  **Done: page scrolling**. Use it or Escape to return to page gestures. The page remains
  scrollable outside the canvas, and Tab can leave it. Changing mode during an active gesture
  takes effect after fingers are lifted.
- **Mouse:** drag pans; Ctrl/⌘ + wheel zooms. Ordinary wheel scrolling remains page scrolling.
- **Keyboard:** focus the map, then arrows pan, +/− zoom, Home resets, and Escape exits touch
  navigation. Tab reaches controls, the neighborhood chooser, one neighborhood path, and markers.
  On a neighborhood path, `[` / `]` moves through source features and Enter/Space selects.
  The native chooser is also available for areas outside the current view.
- Pointer cancellation, loss of capture, window blur, and resizing cancel active gestures.
  There is no animated camera or inertia. Button transitions are disabled with reduced motion.

### Examples and verification

Run `pnpm demo` and serve the repository root. `examples/generated/index.html` covers static
maps, `explorer.html` covers the full explorer, and `interactive.html` covers independently
controlled neighborhood selection, 36 overlapping sample markers, and fit/save/restore hooks.
Storybook **Maps / Reusable interactive map** includes both themes, selectable neighborhoods,
independent layers, dense markers, and a 390px example.

With that server running, the browser regression checks can be run through the installed CLI:

```sh
agent-browser skills get core --full
agent-browser --session sf-map-check open http://127.0.0.1:8765/examples/generated/interactive.html
agent-browser --session sf-map-check eval "import('/scripts/check-interactive-browser.mjs').then(m => m.checkInteractiveBrowser())"
agent-browser --session sf-map-check close
```

These checks cover actual browser layout, both themes, narrow/wide containers, label collisions,
zoom extremes, keyboard selection, cancellation logic, viewport state, marker reachability, and
teardown. Physical iOS Safari and Android Chrome verification remains required before a release:
check page scroll and browser pinch in default mode; map pan and pinch in engaged mode; lift one
finger; interrupt/cancel; rotate; use Done; verify scrolling resumes. Desktop automation and
synthetic pointer tests do not establish physical-device compatibility.
