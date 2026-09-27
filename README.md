# San Francisco SVG maps

[![npm version](https://img.shields.io/npm/v/@kahwee/sf-map-svg)](https://www.npmjs.com/package/@kahwee/sf-map-svg)

[Live atlas](https://kahwee.github.io/sf-map-svg/) · [Example gallery](https://kahwee.github.io/sf-map-svg/examples.html) · [Code recipes](docs/EXAMPLES.md) · [Data guide](data/README.md) · [Sources](SOURCES.md) · [Contributing](CONTRIBUTING.md)

Self-contained SVG maps of San Francisco, with precise coastlines, soft district colors, parks, roads, BART stations, and searchable neighborhoods. Render static SVGs in Node or add an interactive map to a browser. All geometry is bundled; there are no runtime dependencies, map tiles, API keys, or external data requests.

![San Francisco district maps with optional neighborhood boundaries](docs/map-preview.png)

## Choose a starting point

| Goal | Example | API |
| --- | --- | --- |
| Explore real election data | [California propositions by SF district](https://kahwee.github.io/sf-map-svg/propositions.html) or [local measures](https://kahwee.github.io/sf-map-svg/measures.html) | `custom-map` |
| Make a small interactive city map | [Neighborhood guide](https://kahwee.github.io/sf-map-svg/#explore-more-title) | `/guide` |
| Render a static or custom SVG | [Code recipes](docs/EXAMPLES.md) | `/static` or `/custom-map` |
| Animate a route | [BART journey](https://kahwee.github.io/sf-map-svg/transit.html) | `/transit` or overlays |

## Install

```sh
pnpm add @kahwee/sf-map-svg
```

Use Node 22.12+ for server-side rendering. Browser components need a DOM and a bundler that supports the package’s JSON imports.

| Start with | Entry point | What you get |
| --- | --- | --- |
| v2 controller | `@kahwee/sf-map-svg` or `/map` | Explicit data, grouped options, managed events and camera |
| v2 static SVG | `@kahwee/sf-map-svg/static` | Server-safe rendering with explicit data |
| Compatibility static SVG | `@kahwee/sf-map-svg/legacy` | Original renderer with bundled geography |
| Data-injected SVG | `@kahwee/sf-map-svg/custom-map` | Tree-shakeable renderer core with only the geographic data you provide |
| Neighborhood explorer | `@kahwee/sf-map-svg/explorer` | Search, source selection, map controls, GeoJSON downloads |
| Interactive map | `@kahwee/sf-map-svg/interactive` | Embeddable map and controls without the explorer sidebar |
| Data-injected interactive map | `@kahwee/sf-map-svg/interactive-data` | Interactive shell without bundled geographic JSON |
| Lightweight guide map | `@kahwee/sf-map-svg/guide` | Curated overview geography, with detailed data loaded explicitly |
| Animated transit demo | `@kahwee/sf-map-svg/transit` | Optional, schematic BART journey with playback controls |
| Geographic data | `@kahwee/sf-map-svg/data` | Source-aware lookup and canonical GeoJSON |
| Metadata search | `@kahwee/sf-map-svg/data/catalog` | Search names without polygon geometry |
| SFAR lookup | `@kahwee/sf-map-svg/data/realtor` | Default neighborhoods without alternative sources |

## Version 2: explicit data and a controller

```js
import { createMap } from '@kahwee/sf-map-svg';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';
import { guideOptions } from '@kahwee/sf-map-svg/presets';

const map = createMap(guideMapData, {
  ...guideOptions,
  features: { motion: true, markerEntrance: true, clustering: true },
  appearance: { colors: { water: '#e6f1f5' } },
});
document.querySelector('#map').append(map.element);
map.configure({ features: { motion: false }, controls: { pan: false } });
const unsubscribe = map.on('markerchange', ({ marker }) => console.log(marker?.id));
map.camera.reset({ animate: false });
// On component disposal: map.destroy();
```

The root and `/map` include no geography; `/static` includes no interactive runtime.
`guide/data` supplies only overview geography; `/presets` supplies configuration only.
Camera methods share `{ animate, duration }`. `configure()` accepts the same feature,
layer and control groups as construction and validates the entire patch before applying
it. Appearance is construction-only. The controller's `on()` returns an unsubscribe
function and disposal removes all its subscriptions. Operations after disposal throw;
`destroy()` itself is idempotent.

`renderMap(data, options)` from `/static` returns `{ svg, project, ... }` and needs only
`StaticMapData` (for example, `guideMapData.map`). Static options retain their SVG-unit
semantics; camera/motion/control options belong exclusively to the browser controller.
See [v2 migration and architecture](docs/migration-v2.md) for breaking changes,
configuration resets, and bundle boundaries. Existing subpaths remain compatibility APIs.

## Render a static map

```js
import { writeFile } from 'node:fs/promises';
import { renderSFMap } from '@kahwee/sf-map-svg/legacy';

const svg = renderSFMap({
  landmarks: true,
  bartStations: true,
  highways: true,
  neighborhoodLines: true,
  markers: [{ id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park' }],
});

await writeFile('san-francisco.svg', svg);
```

For smaller browser bundles, import `createSFMapWithData` from
`@kahwee/sf-map-svg/custom-map` and pass only the geographic assets your map uses.
That entry point does not import the package's built-in JSON collections. Its `SFMapData`
requires the coast and accepts selected district vintages plus optional neighborhood,
road, park, and station arrays. Use the canonical JSON subpaths documented in
[`data/README.md`](data/README.md) as source; map each feature collection to the
corresponding `SFMapData` records. The `/legacy` entry includes the built-in datasets for migration. The v2 root
imports no geographic JSON.

In tree-shaking bundlers, importing a single symbol from `/data` retains only the
modules that symbol uses.
`searchNeighborhoods` needs catalog metadata but no polygon geometry. The synchronous
source-switching `getNeighborhood` still needs all three neighborhood collections;
use `/data/realtor` when only the default SFAR definitions are needed. Optional coast,
district, road, park, and station collections also have independent `/data/*` entries.
See [the measured bundle report](docs/module-bundle-report.md).

The same split is available for browser controls with
`@kahwee/sf-map-svg/interactive-data`. Pass an `InteractiveSFMapData` object containing
`map` (the `SFMapData` used by the static renderer) and only the neighborhood collections
you want available. This keeps alternative neighborhood sources, unused district vintages,
and optional layers out of that entry's bundle. The normal `/interactive` entry retains its
built-in datasets and synchronous source switching.

For the curated guide map, import `@kahwee/sf-map-svg/guide`. Its overview preset contains
only the simplified coastline, SFAR areas, major parks, BART points, US 101 / I-280 /
Highway 1, and Market, Van Ness, Geary, Lombard, 19th Avenue, and the Embarcadero. It does
not import historical districts, other neighborhood sources, or the full street network.
Collision-filtered neighborhood labels are enabled by default. Road geometry and road labels
have independent `layers.keyRoads` and `layers.roadLabels` controls. Lombard geometry and its
label appear after 1.8× zoom; major street labels can appear at city scale in a smaller type size.

```ts
import { createGuideMap } from '@kahwee/sf-map-svg/guide';
import { loadGuideDetailedData } from '@kahwee/sf-map-svg/guide/detailed';
import { createInteractiveSFMapWithData } from '@kahwee/sf-map-svg/interactive-data';

const map = createGuideMap({ layers: { roadLabels: false } });
document.querySelector('#map')!.append(map);

// Load only when the user asks for closer geographic detail.
const detailedData = await loadGuideDetailedData();
const detailedMap = createInteractiveSFMapWithData(detailedData, {
  mode: 'neighborhoods',
  layers: { highways: true, keyRoads: true, roadLabels: true },
});
```

Run `pnpm data:guide` to rebuild the subpixel overview geometries from canonical files.
`docs/guide-bundle-report.md` records compressed bundle sizes and verifies the included data.
The detailed loader is also re-exported from `/guide` for compatibility; importing only
that function no longer puts overview geography in the initial bundle.

```js
import coast from '@kahwee/sf-map-svg/data/coast.json' with { type: 'json' };
import realtor from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };
import { createInteractiveSFMapWithData } from '@kahwee/sf-map-svg/interactive-data';

const map = createInteractiveSFMapWithData(
  {
    map: { coast: coast.features[0].geometry },
    neighborhoods: { realtor },
  },
  {
    layers: {
      districtFills: false,
      districtLines: false,
      districtLabels: false,
      landmarks: false,
      bartStations: false,
      highways: false,
      keyRoads: false,
    },
  },
);
document.querySelector('#map').append(map);
```

Embed the returned SVG markup directly in a page; in Astro, use `<div set:html={svg} />`. User-supplied text and attributes are XML escaped. Use a distinct `idPrefix` for each map when combining independently rendered SVGs.

## Static options

| Option | Default | Purpose |
| --- | --- | --- |
| `year` | `2022` | District boundaries: `2002`, `2012`, or `2022` |
| `districtLines` | `true` | Supervisorial district outlines |
| `neighborhoodLines` | `false` | Dashed SFAR realtor neighborhood outlines |
| `theme` | `'districts'` | Use `'transit'` for pale blue water, ivory land, green parks, and blue BART symbols; custom `colors` still take precedence |
| `districtFills` | `true` | Original Site’s eleven muted district colors |
| `labels` | `true` | Master switch for visible map text; symbols and accessible titles remain |
| `districtLabels` | `true` | District number badges |
| `highways` | `false` | Original Site’s highway geometry |
| `landmarks` | `false` | Golden Gate Park, Presidio, Lincoln Park, Twin Peaks, Dolores Park, and McLaren Park |
| `bartStations` | `false` | Eight San Francisco BART stations with blue rings and names |
| `width`, `height` | `800`, `800` | SVG viewBox and intrinsic size |
| `padding` | `28` | Space around the coast |
| `markers` | `[]` | Points with `id`, `lng`, `lat`, optional `label`, `color`, `selected` |
| `keyRoads` | `false` | Six selected street corridors: Market, Van Ness, Geary, Lombard, 19th Avenue, and the Embarcadero |
| `roadLabels` | Same as `keyRoads` | Road labels independently of their geometry |
| `colors` | Built-in palette | Override `water`, `land`, `district`, `neighborhood`, `highway`, `road`, `park`, `landmark`, `bart`, `label`, `marker`, `selected` |
| `title` | `San Francisco map` | Accessible SVG title |
| `idPrefix` | Unique per process | Set explicitly for deterministic output or independent server renders |

For a plain outline map, set `districtFills: false`. Neighborhood areas are **August 2010 SFAR realtor areas**, not legal boundaries or a historical layer matched to the district year. See [SOURCES.md](SOURCES.md).

`createSFMap(options)` returns `{ svg, project, viewBox }`. `project([longitude, latitude])` gives matching SVG coordinates for custom overlays. Named exports also include `districtYears`, `districtColors`, and `neighborhoodNames`.

Use `theme: 'transit'` for pale water, ivory land, green parks, and blue BART symbols. Custom `colors` override the preset. Park and station overlays represent current source geography, independently of the district year; stations outside San Francisco, including Daly City, are excluded.

`keyRoads: true` adds the six curated orientation streets using DataSF centerlines. These are orientation features, not routing guidance. The lightweight guide shows primary corridors at city scale and Lombard after zooming.


## Neighborhood explorer

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

The `@kahwee/sf-map-svg/interactive` entry point provides a map, accessible controls, and
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
| `layers` | Mode defaults | Independent booleans: `districtFills`, `districtLines`, `districtLabels`, `neighborhoodLines`, `neighborhoodLabels`, `landmarks`, `bartStations`, `highways`, `keyRoads` (geometry), `roadLabels` |
| `labels` | `true` | Master visible-text switch; accessible descriptions and station symbols remain |
| `labelSize` | `{ min: 11, max: 12 }` | Neighborhood and other labels use this screen-pixel range (8–32 allowed); road labels stay smaller at 9px, capped by `max`. Sizes never grow with zoom |
| `selectableNeighborhoods` | `true` | Enables pointer/keyboard selection; false retains geography and labels |
| `neighborhood` | Unset | Initial name, alias, or ID in the selected source |
| `fitPadding` | `24` | Screen pixels, number or `{ top, right, bottom, left }`, used by selection and geometry fitting after mounting |
| `markers` | `[]` | Supplied `MapMarker` records with unique, nonempty IDs; no content fetching |
| `markerRadius` / `markerHitSize` | `6` / `44` | Screen-pixel visible radius and tap-target diameter, independent of zoom; selected radius grows by 2px |
| `markerColor` / `selectedMarkerColor` | `#245b61` / `#f04f32` | Default marker colors; individual `marker.color` overrides the unselected color |
| `onMarkerActivate` | Unset | Called when a non-null marker selection changes, including programmatic changes |
| `overlays` | `[]` | GeoJSON line or polygon overlays with stable IDs and optional SVG styles |
| `style` | Built-in tokens | Explorer CSS tokens: `ink`, `surface`, `accent`, `border`, `focus`, `controlGap`, `font` |
| `strings` | English defaults | Replace visible map labels and gesture help for localization |
| `controls` | All enabled | Independently hide `zoom`, `pan`, `reset`, `labels`, `touch`, `legend`, `neighborhoodPicker`, `markerPicker`, `help`, or `status`; source attribution remains visible |

For a compact embed, hide the native choosers only when the page already lists every
marker or area as an accessible control. Hidden help remains the map's accessible
description, and a hidden status line remains a polite live region:

```js
const map = createGuideMap({
  interface: 'map',
  controls: { labels: false, neighborhoodPicker: false, markerPicker: false, help: false, status: false },
  strings: { chooseMarker: 'Place on map' }, // also used after setMarkers() updates
});
```

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
`setOverlays(overlays)` replaces all consumer overlays; each overlay has a unique `id`,
WGS84 `LineString`, `MultiLineString`, `Polygon`, or `MultiPolygon` geometry, optional
`stroke`, `strokeWidth`, `fill`, `fillOpacity`, `visible`, and accessible `label`. Overlays
track every pan, zoom, resize, and source change and render above geography but below markers.
They are decorative and do not participate in label collision layout.

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

## Geographic data and lookup

All map geometry is available through stable JSON package exports. There are three district files (2002, 2012, 2022), the full 117 SF Find neighborhoods, 41 analysis neighborhoods, 92 realtor-defined areas, and separate coastline, highway, landmark, and BART files. Neighborhood records include a canonical display name, exact source name, stable ID, aliases where documented, source definition, and full polygon geometry.

```js
import { getRealtorNeighborhood } from '@kahwee/sf-map-svg/data/realtor';
import { searchNeighborhoods } from '@kahwee/sf-map-svg/data/catalog';

const mission = getRealtorNeighborhood('Inner Mission');
const outerMission = getRealtorNeighborhood('Outer Mission');
const nopa = getRealtorNeighborhood('NoPa');
const matchingDefinitions = searchNeighborhoods('mission');
```

These are 250 **source-specific definitions**, not 250 distinct neighborhoods. Canonical names are package display names, and boundaries reflect each documented source rather than a claimed universal consensus. Mission and Outer Mission remain distinct. JSON files are the source of truth used by the renderer; the default map and lookup use the 92 SFAR realtor neighborhoods. See [the data API guide](data/README.md) for all filenames, schema, lookup rules, source comparisons, and custom SVG overlays. Storybook provides downloadable JSON files beside its neighborhood examples.

## Development

Requires Node 22.12+ and pnpm 12. The library uses strict TypeScript; the build emits JavaScript and declarations to `dist/`.

```sh
pnpm install --frozen-lockfile
pnpm check            # formatting, data catalog, types, and tests
pnpm demo             # generated SVGs and example pages
pnpm build-storybook  # static component documentation
pnpm test:stories     # Storybook 10 browser checks in Chromium
pnpm test:stories:coverage # Chromium checks plus renderer coverage report
pnpm test:package     # install and check the packed package
```

Use `pnpm format` to apply Biome formatting and safe lint fixes. Install Chromium once with `pnpm exec playwright install chromium` before local Storybook tests. Run `pnpm storybook` for interactive component examples at http://127.0.0.1:6006. The coverage command writes `coverage/storybook/coverage-summary.json` and `lcov.info` for `src/` TypeScript only. CI runs package and Chromium Storybook checks on Node 26 and uploads the coverage report. See [CONTRIBUTING.md](CONTRIBUTING.md) for source structure and release instructions.

### Browser verification


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

## GitHub Pages

The [civic atlas](https://kahwee.github.io/sf-map-svg/) leads with certified June 2026 ballot measure results. Visitors can select a measure and district, switch Yes/No shading, compare the official 2002, 2012, and 2022 district maps, and play a schematic BART journey. The boundary animation morphs matched district outlines between dated SVGs. Intermediate shapes illustrate the change; each completed year uses its exact published geometry. Playback is user initiated, pauses when the page is hidden, and switches instantly when reduced motion is requested. The lightweight neighborhood guide loads on demand. The full [ballot measures explorer](https://kahwee.github.io/sf-map-svg/measures.html) spans all three district map years with four separately sourced election snapshots.

The [candidate vote explorer](https://kahwee.github.io/sf-map-svg/candidates.html) maps
56 certified federal, statewide, and state legislative contests across six
San Francisco elections from 2016 to 2026. It loads one election JSON on
demand, marks districts only partly eligible for House or legislative races,
and keeps the 2012 and 2022 supervisorial map vintages distinct. Applications
can import a snapshot explicitly from a local build, and from npm after the
next package release, without adding it to the default renderer:

```js
import election from '@kahwee/sf-map-svg/data/candidates/2024-11-05.json' with { type: 'json' };
```

See the [candidate schema](data/candidates/README.md), [source records](SOURCES.md),
and [next dataset ideas](docs/data-opportunities.md).

```sh
pnpm build:pages             # local preview
pnpm build:pages --released  # use the current npm release
python3 -m http.server 8765 --directory pages-dist
# Open http://localhost:8765
```

The build bundles assets into `pages-dist/` with relative URLs for GitHub’s project path. Local builds use the working package; deployed builds use npm’s latest stable package for both browser components and SVG downloads. The page shows that version and links to its release notes. `pages-dist/release.json` records the build’s version and source.

`.github/workflows/pages.yml` validates and deploys on pushes to `main` and after successful npm publishing. Release-triggered builds wait for registry processing before using the newly published version. Pages deployment does not publish npm packages or releases.

## License and attribution

MIT-licensed software, originally extracted from KahWee’s San Francisco District Map. Geographic data retains its source terms and attribution requirements; see [LICENSE](LICENSE) and [SOURCES.md](SOURCES.md). Neighborhood definitions vary by source and are not legal boundaries or a claim of universal consensus.

### Schematic transit animation

```js
import { createTransitAnimation } from '@kahwee/sf-map-svg/transit';
const animation = createTransitAnimation();
document.querySelector('#transit').append(animation);
// On removal: animation.destroy();
```

This optional browser component starts paused, with Play/Pause and a keyboard-accessible journey slider. A loop lasts 28 seconds; timing is illustrative. It connects the bundled official BART station centroids with straight segments, not actual tracks or live service. It pauses when the page is hidden. No autoplay means reduced-motion users can inspect the static map or scrub manually. Existing map defaults are unchanged.

Embed the Pages demo with `<iframe src="https://kahwee.github.io/sf-map-svg/transit.html" title="Schematic BART journey" loading="lazy" style="width:100%;height:clamp(650px, calc(100vw + 240px), 930px);border:0"></iframe>`.

## Ballot measures explorer

[Explore local ballot measures](https://kahwee.github.io/sf-map-svg/measures.html): 44 measures from the November 2002, November 2012, November 2022, and June 2026 elections, across all three supported district map vintages. Pick an election, search its measures, inspect a district, compare two measures, and download an SVG, CSV, or the sourced JSON. The page includes touch pan/zoom, keyboard district selection, a sortable district table, and shareable year-specific views. Each election's results and district map load on demand. This is an archive of four elections, not every intervening election or a live results service. See [the election data schema](data/elections/README.md) and [SOURCES.md](SOURCES.md) for methods and source links.

### Motion, styling, and progressive embeds

The guide now exposes the same `colors` palette as the static renderer. Existing
appearance and immediate camera movement remain the defaults. See
[consumer integration recommendations](docs/consumer-integration.md) for the
complete example, bundle choices, progressive shell, and testing contract.

```js
import { createGuideMap } from '@kahwee/sf-map-svg/guide/map';

const map = createGuideMap({
  colors: { water: '#202d38', land: '#34434a', park: '#42624d',
    road: '#728080', neighborhood: '#64767e', label: '#f1f3ee' },
  labelStyle: { fontFamily: 'DM Sans, system-ui, sans-serif', fontWeight: 550,
    haloColor: '#34434a' },
  motion: { duration: 400 },
  markerEntrance: { duration: 450, stagger: 35 },
  selectedMarkerRing: { color: '#f1f3ee', width: 2, gap: 3 },
  clustering: { radius: 32 },
  attribution: 'compact',
  legend: { items: [{ label: 'Places', color: '#cf8757' }] },
  northArrow: true,
  scaleBar: true,
  strings: { touchNavigation: 'Touch pan', touchNavigationLabel: 'Enable touch pan',
    touchNavigationDone: 'Done', touchNavigationExitLabel: 'Restore page scrolling' },
});
document.querySelector('#map').append(map);
```

| Option | Contract |
| --- | --- |
| `colors` | Static palette keys: water, land, district, neighborhood, highway, road, park, landmark, BART (`bart`), label, marker, selected |
| `labelStyle` | `fontFamily`, numeric `fontWeight`, `haloColor`; the application loads any custom font |
| `areaStyle` | `selectedFill`, `selectedStroke`, `hoverFill`, `hoverStroke`; applies to selectable neighborhoods |
| `motion` | `false` by default; `true` uses 320ms, or `{ duration }` in milliseconds |
| `markerEntrance` | `false` by default; `true` uses 420ms and 35ms stagger, or `{ duration, stagger }`; only newly introduced IDs animate, delay capped at 1s |
| `MapMarker.radius` | Per-marker visible radius; interactive units are CSS pixels, static units are SVG units |
| `selectedMarkerRing` | Optional `{ color, width, gap }` in CSS pixels; preserves the hit target |
| `clustering` | `false` by default; `true` or `{ radius }` groups nearby screen positions; selected pin remains independent |
| `legend` | `{ builtins: false, items: [{ label, color }] }` replaces built-ins; omit `builtins` to append custom entries; `hidden` hides selected built-ins (`bart`, `park`, `highway`, `road`) |
| `attribution` | `'full'` (default) or `'compact'`; compact keeps full provenance in a native disclosure |
| `northArrow`, `scaleBar` | Optional canvas furniture; scale is approximate at central SF latitude, in metric units |

`setViewport(view, { animate, duration })`, `fitGeometry(geometry, padding,
{ animate, duration })`, `selectMarker(id, { fit, animate, duration })`, and
`selectNeighborhood(name, { fit, animate, duration })` accept per-call motion
controls. `animate: true` opts in even when global motion is disabled.
`stopAnimation()` freezes the camera at its current viewport. A new camera
operation replaces the previous transition; pointer gestures interrupt it.
Reduced-motion preference overrides all animation requests. `destroy()` cancels
camera frames, marker animations, listeners, and resize observation.

`map.overlayElement` is a public HTML overlay slot. `map.projectToScreen(lng, lat)`
returns `{ x, y, visible }` in CSS pixels relative to that slot. Call it after
mounting; reposition your callout on `viewportchange` and `mapresize`.
The slot ignores pointer events; interactive children can set `pointer-events:auto`.
`clusteractivate` emits `{ markers }` and fits their geographic extent. Coincident
pins cannot separate through zoom; retain the full native marker chooser or an
accessible external list. `--sf-marker-index` on each marker is a stable entrance
index hook, but the built-in animation avoids the need to style internal SVG.

For server rendering, `createGuideSVG(options)` from `@kahwee/sf-map-svg/guide/static`
uses the same simplified geography as the browser guide with one import.
`createGuideShell(options)` also reserves compact toolbar, legend, and attribution
rows; pass its `.sf-guide-shell` element to `mountGuideMap(shell, options)` from
`@kahwee/sf-map-svg/guide/map`. By default, this compact layout hides the native
pickers, pan buttons, label switch, help, and visible status; explicit control overrides are honored. Provide an accessible
external place list. The toolbar and legend scroll horizontally if needed.

### Reconfigure without rebuilding

Construction options remain backward-compatible. Use these atomic patches for
runtime switches; they preserve the map element, viewport, markers, and selection:

```js
map.setFeatures({ motion: false, clustering: true, selectedMarkerRing: true });
map.setLayers({ landmarks: false, bartStations: true, roadLabels: false });
map.setControls({ zoom: false, reset: true, touch: true });
```

`setFeatures` accepts the exported `MapFeatures` interface: `motion`,
`markerEntrance`, `clustering`, `selectedMarkerRing`, `northArrow`, and `scaleBar`.
Every feature accepts `false` to disable; the first four also accept `true` for
built-in settings or an options object. Omitted patch keys retain their settings;
`undefined` resets that key to the default. Options objects **replace** the previous
object for that feature; they do not deep-merge. `getFeatures()` returns a detached,
normalized snapshot. Changing motion cancels the current transition; changing
entrance settings cancels active entrances and applies to future new marker IDs.

`setLayers` accepts `InteractiveLayers`; `undefined` restores the mode default.
Geometry, associated labels, built-in legend entries, and attribution update
together. Roads and road labels remain independent switches. Toggling does not
remove geography already imported into a client bundle.

`setControls` accepts the same keys as `controls`. Hiding zoom no longer hides
Reset, Labels, or Touch. Hiding the touch button disengages touch navigation so
page scrolling stays recoverable. Unknown switch names and invalid values throw
before modifying state. After `destroy()`, setters are no-ops and disposal can be
repeated safely. Getters return the last state; screen projection still requires
a mounted, visible canvas.

For configuration precedence, malformed inputs, callback reentrancy, and lifecycle
ownership, see the [maintainer API audit](docs/api-audit.md).
