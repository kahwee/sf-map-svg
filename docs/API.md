# Map options and lifecycle

Start with the [static and interactive examples](../README.md). Exact option
and event types are exported by [src/api.ts](../src/api.ts) and defined in
[src/types.ts](../src/types.ts) and [src/controller-types.ts](../src/controller-types.ts).

## Static maps

Static options include `theme`, `width`, `height`, `padding`, `year` (2002, 2012, 2022), `districtLines`, `districtFills`, `districtStyle`, `districtLabels`, `neighborhoodLines`, `labels`, `highways`, `keyRoads`, `roadLabels`, `landmarks`, `bartStations`, `markers`, `overlays`, `title`, `idPrefix`, `colors`, and `animation`. Each optional layer is independent. User-supplied text and attributes are escaped in SVG output.

Custom district IDs must be finite numbers. An empty `labelPoints` array uses the district's primary `label` position.

`animation: true` (or `{ duration, delay }`) makes a static map draw itself with self-contained, scoped CSS: land fades in, the coast and lines draw, districts grow, then labels and points appear. It plays when the SVG is inserted into a page or loaded as an image, needs no JavaScript, and stays still under `prefers-reduced-motion`. Re-insert the markup to replay it. Default output is unchanged.

## Interactive maps

`createMap` defaults to `mode: 'basemap'` and `appearance.theme: 'transit'`. Set the mode explicitly for neighborhood or district exploration. District and neighborhood layer defaults follow the mode; other supplied layers default on. The [developer guide](developer-guide.md) compares static and interactive defaults and explains configuration resets, coordinates, and cleanup.

Construction options include `mode` (`basemap`, `neighborhoods`, or `districts`), `source`, `neighborhood`, `year`, `labels`, `layers`, `controls`, `features`, `appearance`, `markers`, `overlays`, `legend`, `strings`, `attribution`, and `fitPadding`. Enable map touch gestures with the touch control or `map.setTouchNavigation(true)`. `features` holds motion, marker entrances, selected marker rings, clustering, north arrow, scale bar, layer transitions, and district morphs. `appearance` holds theme, color tokens, label and area styles, marker colors and sizes, and district styling. `layers` controls district fill/line/labels, neighborhood lines/labels, landmarks, BART, highways, key roads, and road labels. See the exported `MapOptions` type for exact values and the [Storybook examples](../stories/) for live controls.

The controller also supports marker, neighborhood, and district selection; district year and style changes; source and mode changes; labels and touch navigation; screen projection; and typed `markerchange`, `neighborhoodchange`, `districtchange`, `districthover`, `districtactivate`, `districtyearchange`, `overlayactivate`, `clusteractivate`, `viewportchange`, and `mapresize` events. `destroy()` releases browser resources; operations after destruction throw.

If a district callback destroys the map or selects a newer district, the interrupted activation stops without moving keyboard focus or sending a stale event.

`setMarkers()` reconciles by stable marker `id`: retained markers keep their DOM nodes, focus, and in-progress entrance animations; only new IDs animate in. Identical ordered marker updates are a visual no-op. Camera state and `viewportchange` events remain synchronous, while animated camera steps and their dependent label/marker layout commit in the same browser frame.

For a small guide, import `guideMapData` from `/guide/data` and pass it to `createMap`. The optional `/guide` entry also provides `createGuideMap`, `mountGuideMap`, and detailed-data loading for existing guide layouts. `/transit` provides the standalone schematic transit animation. See [examples](EXAMPLES.md) and [consumer integration](consumer-integration.md).

For the guide preset with the same controller API, use `createGuideController(options)` from `/guide` (or `/guide/map`). It accepts grouped `MapOptions` and returns `MapController`; `mountGuideController(shell, options)` enhances a `createGuideShell()` container. Both use the lightweight guide geography. Existing `createGuideMap` and `mountGuideMap` calls retain their element-based API.

Two opt-in features animate the map's lines and layers. `features.layerTransitions` fades layers as `configure({ layers })` and `setMode()` switch them, crossfades neighborhood boundaries when `setSource()` changes the definition, and crossfades district fills on `setDistrictStyle()`. `features.districtMorph` moves district outlines from one map year to the next on `setDistrictYear()`, then settles on the exact published geometry; pass `{ animate: false }` for an instant change. Both default off, own and cancel their animations, and yield to reduced motion.

District style callbacks are evaluated once per district at construction and on style or year updates. Hover, selection, and layer toggles reuse the prepared styles; call `setDistrictStyle()` again when external styling data changes. Invalid styles leave the current map unchanged. District fades respect reduced motion and are removed on interruption or destruction.
