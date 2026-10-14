# Embedding and progressive enhancement

For basic mounting, events and cleanup, start with the [developer guide](developer-guide.md). The root controller takes explicit geography; the guide entry offers a smaller preset with the same grouped `configure()`, `camera`, `on()`, and `destroy()` contract. See the [migration guide](migration-v3.md) for removed v2 imports.

## Render a guide before JavaScript loads

On the server or in a build step, render a compact frame:

```ts
import { createGuideShell } from '@kahwee/sf-map-svg/guide/static';

const markup = createGuideShell({ title: 'Explore San Francisco' });
// Insert markup into your server-rendered HTML.
```

The shell uses an 800 × 800 projection with 28 units of padding, matching the interactive map. Use `createGuideSVG()` for custom dimensions. Rendering is offline, with zero runtime dependencies.

## Keep overview labels consistent

Opt into the browser's overview label priorities and collision rules with a target **canvas width in CSS pixels**:

```ts
const labeledMarkup = createGuideShell({
  title: 'Explore San Francisco',
  labelLayout: { width: 390 },
});
```

This keeps the 800 × 800 projection. It sizes and places text for a 390 px canvas, prioritizes major parks and primary roads, includes neighborhood names, and avoids label, marker, and BART-symbol collisions. BART names and smaller parks remain deferred until interactive zoom. Use the same geography, colors, markers and layer switches when mounting. Set `layers.neighborhoodLabels: false` on both renderers to omit neighborhood names.

The width is a rendering hint, not a responsive script. Generate an appropriate variant for your known embed width; an SVG displayed at another width scales its labels with the artwork. Static layout uses conservative estimated system-font widths, while the browser measures actual fonts and recalculates on resize. Font metrics, custom browser label styles, selection, clustering and HTML overlays can therefore change the final label set or position. This reduces the transition without promising pixel-identical hydration. Existing calls without `labelLayout` keep their original fixed labels.

For a fixed-width embed, use shared inputs on the server and in the browser:

```ts
// Shared inputs: coordinates, IDs, radii, colors and layer choices must match.
const guideMarkers = [
  { id: 'ferry', label: 'Ferry Building', lng: -122.3937, lat: 37.7955, radius: 7 },
];
const guideLayers = { neighborhoodLabels: true, roadLabels: true };
const guideColors = { label: '#183e58', landmark: '#426641' };

// Server: place this HTML in a canvas that is 390 CSS pixels wide.
const labeledPlacesMarkup = createGuideShell({
  labelLayout: { width: 390 },
  markers: guideMarkers,
  layers: guideLayers,
  appearance: { colors: guideColors },
});
```

After inserting that markup, pass `markers: guideMarkers`, `layers: guideLayers`, and `appearance: { colors: guideColors }` to `mountGuideController()` as shown below. The static-only `labelLayout` option is not a browser option: the controller measures the actual canvas and font. The shell border is outside the canvas, so a default shell with a 390 px outer width has a 388 px canvas.

For responsive layouts whose canvas width is unknown at build time, use `labelLayout.compact` for an embedded image with two static label layouts (see [editorial previews](#editorial-map-previews)), choose a representative width and accept text scaling until enhancement, or serve independently rendered SVG variants through your application's responsive markup. The package does not detect a device on the server. Keep `labels: false` if your design requires no visible text change at enhancement.

For `renderMap()`, also enable `neighborhoodLabels` explicitly; it defaults off outside the guide preset. `labels: false` hides all text in either layout while preserving symbols and accessible titles.

## Enhance the existing frame

In your browser entry, mount the controller into that shell:

```ts
import { mountGuideController } from '@kahwee/sf-map-svg/guide';

const shell = document.querySelector<HTMLElement>('.sf-guide-shell');
if (!shell) throw new Error('Missing guide shell');
const guide = mountGuideController(shell, {
  attribution: 'compact',
  features: { motion: { duration: 400 }, markerEntrance: true },
  markers: guideMarkers,
  layers: guideLayers,
  appearance: { theme: 'transit', colors: guideColors },
});

// Call before your application removes the containing view.
function disposeGuide() {
  guide.destroy();
}
```

Compact attribution is required for an existing shell. Invalid configuration leaves its static frame intact. `destroy()` disposes listeners and animation work; your application owns removal of the containing view. Motion is opt-in and follows reduced-motion preferences.

For a new browser-only guide, use `createGuideController()` and mount its `.element` as shown in the developer guide. Existing `createGuideMap()` and `mountGuideMap()` retain their augmented-element return types and flat options for compatibility.

## Choose the data boundary

`createMap(guideMapData, guideOptions)` remains available through `/guide/data` and `/presets`. For server rendering, pass `guideMapData.map` or `/data/static` to `renderMap()`. Use `/data/full` when interactive lookup collections are needed. The guide's detailed geography loads only on an explicit `loadGuideDetailedData()` call; enabling a layer does not download it.

See the [exact API contract](API.md), [worked examples](EXAMPLES.md), and [bundle measurements](guide-bundle-report.md).


## Editorial map previews

YorkSF uses one city overview to connect its field notes and compact locator maps to orient individual articles. These patterns work for any local guide: keep the place catalog in the consuming application, generate SVG images at build time, and link each preview to the application's map or article route.

Run `pnpm demo` and open `examples/generated/field-guide.html` for a self-contained light/dark example. Its overview uses `labelLayout.compact` to limit mobile text without removing pins, and `haloColor` to match the night palette. The locator cards share those colors but omit labels at small sizes. Images reserve their aspect ratio and load lazily; the links work without JavaScript. The example derives its sample park coordinates from the package's existing landmark data rather than maintaining another geographic dataset.

Use stable marker IDs for deep links. Keep addresses, visit dates, historical-status caveats, and editorial descriptions in your own content model. The package supplies map graphics; it does not imply that a place is currently open or that an author visited it. Keep a visible list beside the overview so the image is not the only way to find a place. SVG alt text should describe its purpose; link text should name the destination.

For an image card, `compact.width` follows the image's rendered viewport. For inline SVG it follows the outer document viewport; do not assume it behaves like a container query. Avoid embedding scripts in exported images. Interactive maps remain a separate progressive enhancement.
