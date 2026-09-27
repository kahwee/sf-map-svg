# Consumer integration and testing

For new integrations, use the [v2 controller](migration-v2.md). The compatibility
recipes below remain supported for existing guide and progressive-shell consumers.

## Choose the import graph deliberately

Use `@kahwee/sf-map-svg/guide/map` for a guide using SFAR neighborhoods. It includes
only overview coast, SFAR boundaries, selected parks and roads, and BART. The
compatibility `interactive` import includes all supported district vintages and
neighborhood collections. Hiding a layer at runtime does not remove its imported
geometry from a bundle.

Use `interactive-data` for a renderer with **no bundled geography**. Supply the
`InteractiveSFMapData` you need, optionally from a separately cached, same-origin
asset produced at build time. This can improve caching and initial loading; it
does not eliminate the cost of transmitting that geography. Serve local assets
with compression and normal long-lived versioned cache headers. Avoid root or
`data` barrel imports in client code when only one collection is needed.

Load `guide/detailed` only after a user requests higher detail. Dynamically import
the browser map when its container approaches the viewport. Keep the static
renderer in server/build code; do not import it in a client loader. The overview
SVG still contains geography, so both static and interactive representations cost
bytes. Measure HTML and JS separately, including compressed bytes and lazy chunks.
Do not inline full-detail data into every page.

`pnpm report:guide` records measured raw/gzip sizes and audits included datasets.
`pnpm check` enforces 125 KiB initial guide and 35 KiB data-free renderer budgets.
These are regression ceilings, not claims about every application's final bundle.
Current measurements are in [the bundle report](guide-bundle-report.md).

## Progressive compact layout

Build/server code:

```js
import { createGuideShell } from '@kahwee/sf-map-svg/guide/static';
const html = createGuideShell({ markers: places, labels: false });
// Put html into the page alongside an accessible place list.
```

Browser code:

```js
import { mountGuideMap } from '@kahwee/sf-map-svg/guide/map';
const map = mountGuideMap(document.querySelector('.sf-guide-shell'), {
  markers: places,
  labels: false,
  motion: { duration: 400 },
  markerEntrance: true,
  clustering: true,
  selectedMarkerRing: { color: '#163d61' },
  strings: { touchNavigation: 'Touch pan', touchNavigationDone: 'Done' },
});
// In your place list's activation handler:
map.selectMarker(places[0].id);
// On component disposal:
// map.destroy();
```

Pass the same palette, markers, and layer choices to both sides. `labels:false`
avoids a label-placement change during enhancement: static labels and interactive
collision placement are different algorithms. Shell placeholders are not working
controls, and the SVG remains available without JavaScript. The compact shell
reserves its own rows at all widths; it is not a general serializer for arbitrary
explorer chrome. Keep external image/card aspect ratios and list heights stable as
well: a library shell cannot prevent shifts elsewhere in your page.

## Callouts without private DOM selectors

```js
const callout = document.createElement('div');
callout.textContent = 'Selected place';
callout.style.position = 'absolute';
map.overlayElement.append(callout);
const placeCallout = () => {
  const pin = map.getSelectedMarker();
  if (!pin) { callout.hidden = true; return; }
  const point = map.projectToScreen(pin.lng, pin.lat);
  callout.hidden = !point.visible;
  callout.style.transform = `translate(${point.x}px, ${point.y}px)`;
};
for (const event of ['markerchange', 'viewportchange', 'mapresize'])
  map.addEventListener(event, placeCallout);
```

These coordinates are relative to the canvas, not the page. Callout size,
collision avoidance, and focus belong to the application. Use `textContent` for
untrusted text. Consumer-added listeners should be removed on disposal (or use
an application-owned AbortSignal).

## Motion and dense places

Camera motion and marker entrances are independent and optional. Keep stable pin
IDs across filtering so existing places do not repeatedly drop in. A subsequent
camera request supersedes an earlier one. Reduced motion wins over application
options; changing the preference during motion stops at the current position.

Clustering uses a deterministic screen-distance grouping in stable marker-ID order using a spatial index. It is
intended for guide-sized lists, not millions of records. Clicking or pressing Enter
on a cluster fits its extent and emits `clusteractivate`. Exactly coincident places
remain clustered even at maximum zoom. Always provide a chooser/list; selecting a
place removes it from its cluster and draws it above clusters. Avoid silently
hiding all alternate access when setting `controls.markerPicker:false`.

## Verification expectations

Run the existing Node and browser suites plus bundle checks. The Consumer API
stories exercise transitions, supersession, teardown, reduced motion, clustered
selection, touch names, and 390px shell replacement. Also inspect the example page
at desktop/tablet/390px: keyboard focus, drag interruption, labels and marker
collisions, overflow, console errors, and sources disclosure. Test your own
container/font/CSS and delayed image loading before claiming page-wide zero CLS.

## Runtime configuration and failure handling

Prefer `setFeatures`, `setLayers`, and `setControls` over recreating a map for each
checkbox. Patches leave omitted keys alone; explicit `false` disables and
`undefined` resets. Feature option objects replace the previous object, so
`setFeatures({ motion: { duration: 200 } })` is predictable without hidden retained
fields. `getFeatures()` is a detached normalized snapshot, safe for consumer reads.

Invalid feature/control/layer updates preserve the previous state. Invalid marker
and overlay replacements preserve the previous list. Removed overlays lose their
listeners immediately. Repeated disposal cancels all asynchronous work and returns
touch gestures to the page. Focused markers stay reachable through filtering;
when a focused marker disappears, focus returns to the map rather than the page
body. A focused cluster that dissolves also returns focus to the map.

The compact mount uses defaults for its controls, then honors caller overrides.
Enabling native pickers deliberately adds their row. The default shell replacement
has stable geometry; custom controls, fonts, and application CSS still require
consumer verification. Shells reject custom SVG dimensions/padding because the
interactive projection is fixed. Use `createGuideSVG` for custom static sizes.

Adversarial checks cover reentrant camera callbacks, invalid/atomic patches,
feature round trips, control independence, overlay replacement/disposal, detached
configuration snapshots, keyboard focus, and 2,000-marker grouping. The camera,
feature normalization, and spatial grouping modules are separate from DOM rendering
so future options can extend those contracts without rebuilding their lifecycles.

### Adding another optional feature

Add its public type and default to the configuration boundary first. Validate and
copy the full next configuration before touching the current map. Implement enable
and disable symmetrically, and define what happens to in-flight work when it changes.
Avoid hiding unrelated controls through a shared parent. Any window/document/media
listener, observer, animation, or replaceable interactive subtree needs an explicit
owner and cleanup path. Keep camera timing and geographic grouping independently
testable rather than embedding more asynchronous state inside renderer callbacks.

For each addition, test disabled construction, enabling, disabling, repeated round
trips, invalid updates, reduced motion where relevant, and disposal. Verify that the
viewport, selection, keyboard focus, accessible descriptions, and layer legend stay
consistent. Runtime toggles are not a substitute for selective data imports or
production bundle measurement. New palette/font/layout choices still need rendered
consumer checks; passing these tests does not guarantee every arbitrary host CSS or
data combination.

The [maintainer audit matrix](api-audit.md) records option precedence, invalid-input
behavior, callback reentrancy, ownership, and explicit limits. Interactive options
reject unknown keys, including nested typos. Shared preset data is immutable;
clone it before deriving custom collections. The compact mount rejects full
attribution rather than silently overriding it.
