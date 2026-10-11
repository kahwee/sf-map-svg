# Map options and lifecycle

Start with the [static and interactive examples](../README.md). Exact option
and event types are exported by [src/api.ts](../src/api.ts) and defined in
[src/types.ts](../src/types.ts) and [src/controller-types.ts](../src/controller-types.ts).

## Static maps

Static maps accept compact `StaticMapData` or the same source-aware `MapData` as interactive maps. With `MapData`, `source` selects a supplied neighborhood definition; SFAR realtor is preferred by default, followed by SF Find and analysis when available. A requested unavailable source throws before styling callbacks run. Compact `StaticMapData` already chooses its neighborhoods, so it rejects a `source` option. Both data shapes retain the static renderer defaults.

Static maps accept the same grouped presentation vocabulary as interactive maps:

```ts
const presentation = {
  layers: { landmarks: true, bartStations: true },
  appearance: { theme: 'districts' as const, colors: { water: '#e7f0f3' } },
};
const { svg } = renderMap(staticMapData, presentation);
const map = createMap(fullMapData, presentation);
```

Static `layers` supports every interactive layer switch except `neighborhoodLabels`. Static `appearance` supports `theme`, `colors`, and `districtStyle`; browser typography, area interaction styles, and screen-space marker sizing remain interactive settings. Unknown keys and invalid values are rejected for both flat and grouped options. Supplied grouped keys override flat compatibility keys; omitted or `undefined` grouped keys preserve the flat value or renderer default. Undefined color tokens use the theme default instead of entering SVG attributes. The two renderers retain their existing defaults. Marker arrays accept readonly inputs.

Flat compatibility options include `theme`, `width`, `height`, `padding`, `year` (2002, 2012, 2022), `districtLines`, `districtFills`, `districtStyle`, `districtLabels`, `neighborhoodLines`, `labels`, `highways`, `keyRoads`, `roadLabels`, `landmarks`, `bartStations`, `markers`, `overlays`, `title`, `idPrefix`, `colors`, and `animation`. Each optional layer is independent. User-supplied text and attributes are escaped in SVG output.

Custom district IDs must be finite numbers. An empty `labelPoints` array uses the district's primary `label` position.

The SVG description names the selected neighborhood source for source-aware data and uses a generic description for compact inputs. It describes enabled layers only when their data is supplied, using actual park and station counts.

`animation: true` (or `{ duration, delay }`) makes a static map draw itself with self-contained, scoped CSS: land fades in, the coast and lines draw, districts grow, then labels and points appear. It plays when the SVG is inserted into a page or loaded as an image, needs no JavaScript, and stays still under `prefers-reduced-motion`. Re-insert the markup to replay it. Default output is unchanged.

## Interactive maps

`createMap` defaults to `mode: 'basemap'` and `appearance.theme: 'transit'`. Set the mode explicitly for neighborhood or district exploration. District and neighborhood layer defaults follow the mode; other supplied layers default on. The [developer guide](developer-guide.md) compares static and interactive defaults and explains configuration resets, coordinates, and cleanup.

Construction options include `mode` (`basemap`, `neighborhoods`, or `districts`), `source`, `neighborhood`, `year`, `labels`, `layers`, `controls`, `features`, `appearance`, `markers`, `overlays`, `legend`, `strings`, `attribution`, and `fitPadding`. Enable map touch gestures with the touch control or `map.setTouchNavigation(true)`. `features` holds motion, marker entrances, selected marker rings, clustering, north arrow, scale bar, layer transitions, and district morphs. `appearance` holds theme, color tokens, label and area styles, marker colors and sizes, and district styling. `layers` controls district fill/line/labels, neighborhood lines/labels, landmarks, BART, highways, key roads, and road labels. See the exported `MapOptions` type for exact values and the [Storybook examples](../stories/) for live controls.

The controller also supports marker, neighborhood, and district selection; district year and style changes; source and mode changes; labels and touch navigation; screen projection; and typed `markerchange`, `neighborhoodchange`, `districtchange`, `districthover`, `districtactivate`, `districtyearchange`, `overlayactivate`, `clusteractivate`, `viewportchange`, and `mapresize` events. `destroy()` releases browser resources; operations after destruction throw.

If a district callback destroys the map or selects a newer district, the interrupted activation stops without moving keyboard focus or sending a stale event.

`setMarkers()` reconciles by stable marker `id`: retained markers keep their cached nodes, focus, and in-progress entrance animations; only new IDs animate in. Identical ordered marker updates are a visual no-op. Camera state and `viewportchange` events remain synchronous, while animated camera steps and their dependent label/marker layout commit in the same browser frame.

Interactive maps mount only pins and cluster symbols intersecting a padded viewport; clustered member pins detach. All records remain in the native picker and selectable through the API. Selected and keyboard-focused pins stay mounted, even outside the viewport, and retained nodes return when panning back. Cluster membership uses the complete catalog and stays stable during pan at the same zoom. Static SVG exports are unaffected.

Visible markers and clusters share one tab stop. Use `[` and `]` to move focus, Enter or Space to activate, and Tab to leave the group. Arrow keys retain map panning. Marker replacement preserves the focused ID when available and moves focus to a surviving marker when it is removed.

Activating coincident pins opens a place chooser, including when compact embeds hide the native marker picker. Clusters zoom when their members can separate at maximum zoom; otherwise they open the chooser. Escape or Close returns focus to the originating pin or cluster when it remains visible. Choosing a place selects its marker; replacing markers or destroying the map closes the chooser. `clusteractivate` still reports the activated cluster's markers.

For a small guide, import `guideMapData` from `/guide/data` and pass it to `createMap`. The optional `/guide` entry also provides `createGuideMap`, `mountGuideMap`, and detailed-data loading for existing guide layouts. `/transit` provides the standalone schematic transit animation. See [examples](EXAMPLES.md) and [consumer integration](consumer-integration.md).

For the guide preset with the same controller API, use `createGuideController(options)` from `/guide` (or `/guide/map`). It accepts grouped `MapOptions` and returns `MapController`; `mountGuideController(shell, options)` enhances a `createGuideShell()` container. Both use the lightweight guide geography. Existing `createGuideMap` and `mountGuideMap` calls retain their element-based API.

Two opt-in features animate the map's lines and layers. `features.layerTransitions` fades layers as `configure({ layers })` and `setMode()` switch them, crossfades neighborhood boundaries when `setSource()` changes the definition, and crossfades district fills on `setDistrictStyle()`. `features.districtMorph` moves district outlines from one map year to the next on `setDistrictYear()`, then settles on the exact published geometry; pass `{ animate: false }` for an instant change. Both default off, own and cancel their animations, and yield to reduced motion.

District style callbacks are evaluated once per district at construction and on style or year updates. Hover, selection, and layer toggles reuse the prepared styles; call `setDistrictStyle()` again when external styling data changes. Invalid styles leave the current map unchanged. District fades respect reduced motion and are removed on interruption or destruction.

## Live configuration and inspection

`map.configure({ appearance, mode, source, year, labels, layers, features, controls })` updates an existing map. Appearance updates preserve the camera, selections, retained marker nodes, and keyboard focus. Mode/source changes through `configure` preserve the camera; the `setMode(mode, { resetView: false })` and `setSource(source, { resetView: false })` convenience methods use the same atomic update path and preserve the camera. Omit the second argument to retain their existing reset behavior. Invalid view-update options fail before changing configuration. Switching neighborhood source clears the neighborhood selection. Changing district year retains a selected district when it exists in the new year. Unsupported datasets, invalid appearance values, and invalid district-style callback results fail during preparation before commit. A reentrant styling callback can supersede the pending patch.

Appearance token objects (`colors`, `style`, `labelStyle`, `labelSize`, `areaStyle`) merge supplied keys; other appearance properties replace. Omitted keys retain their value, an explicit `undefined` property removes that override, and `appearance: undefined` resets the whole appearance group. Feature objects retain their existing replacement semantics. Mode/source/year/labels ignore `undefined`; reset them with an explicit value. Patch types explicitly permit these resets with TypeScript’s `exactOptionalPropertyTypes` enabled.

```ts
map.configure({
  appearance: { colors: { water: '#142d45' }, labelStyle: { fontFamily: 'Georgia,serif' } },
  layers: { bartStations: false },
});
map.configure({ appearance: undefined }); // restore construction defaults, not initial overrides

const overrides = map.getConfiguration();
const effective = map.getResolvedConfiguration();
const available = map.getCapabilities();
```

`getConfiguration()` returns the current mode, source, year and master labels, together with detached feature, layer, control, and appearance overrides; district style callbacks retain their function identity. `getResolvedConfiguration()` adds the current mode, source, year and master labels and resolves **layer switches** through mode defaults, available data, and the master label switch. Appearance/control fields remain overrides. It does not claim that every label is visible: zoom and collision filtering still apply. `getCapabilities()` returns supplied `sources`, usable district `years`, and layer data availability for the current source/year, independent of visibility overrides. These reads throw after destruction.

## Common selection event

`selectionchange` adds a consistent envelope without changing existing event payloads:

```ts
map.on('selectionchange', (event) => {
  // kind narrows current and previous to the corresponding selection type.
  if (event.kind === 'marker') console.log(event.current?.id, event.previous?.id);
});
```

`kind` is `marker`, `neighborhood`, or `district`. `current` and `previous` are detached selection snapshots or `null`. The event follows committed selection changes, including clearing and a changed district vintage; it does not represent every activation. Existing `markerchange`, `neighborhoodchange`, and `districtchange` events remain supported.

## Source-aware feature selection

`selectFeature(reference, options)` accepts one typed identity for each selectable kind:

```ts
map.selectFeature({ kind: 'marker', id: 'ferry' }, { fit: false });
map.selectFeature({ kind: 'neighborhood', source: 'realtor', id: 'inner-mission' });
map.selectFeature({ kind: 'district', year: 2022, id: 3 });
```

Neighborhood IDs are exact source-scoped feature IDs, rather than display names or aliases. District identity includes the boundary year. This operation returns `false` for a missing feature or a source/year other than the map's current supplied geography; it never silently switches definitions or years. Choose geography through `configure` first. An `id` of `null` clears that kind in the referenced current geography. Malformed references throw. Existing `selectMarker`, `selectNeighborhood`, and `selectDistrict` shortcuts remain supported.

## Coordinates and units

GeoJSON and static projection inputs use `[longitude, latitude]` in WGS84; markers use `{ lng, lat }`. Static `project` returns SVG units. `projectToScreen(lng, lat)` returns pixels relative to the mounted canvas. Camera viewports use the fixed 800 × 800 projected map space, independent of canvas size. Pan deltas use screen pixels, converted using the mounted canvas width. Marker radius uses screen pixels in browser maps and SVG units in static output.

Explore presentation options in the [live map design playground](https://kahwee.github.io/sf-map-svg/playground.html). The page identifies its package version; released builds use compatible options for that installed version.
