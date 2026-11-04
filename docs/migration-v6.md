# Migrating to v6

Version 6 removes the remaining compatibility APIs. Geographic datasets, coordinate
conventions, defaults and rendering precision are unchanged.

## Static presentation

Move flat geographic switches into `layers`, and `theme`, `colors` and
`districtStyle` into `appearance`. Flat presentation keys now throw.

```js
const { svg } = renderMap(staticMapData, {
  width: 800,
  labels: true,
  layers: { landmarks: true, bartStations: true, districtFills: false },
  appearance: { theme: 'transit', colors: { water: '#e7f0f3' } },
});
```

The same contract applies to `getLayerPaths`, `createGuideSVG` and
`createGuideShell`. Dimensions, year, source, master labels, label layout,
markers, overlays, title, ID prefix and animation remain top-level options.

## Guide controllers

Replace `createGuideMap` with `createGuideController`, and `mountGuideMap` with
`mountGuideController`. Both return `MapController`; DOM methods live on `.element`.
The `InteractiveSFMapElement` and `InteractiveSFMapOptions` guide aliases are removed.
Use `MapController` and `MapOptions`.

```js
import { createGuideController } from '@kahwee/sf-map-svg/guide';
const map = createGuideController({
  features: { motion: true, clustering: true },
  appearance: { colors: { water: '#e7f0f3' } },
});
document.querySelector('#map').append(map.element);
map.configure({ layers: { landmarks: false } });
map.camera.reset();
map.on('markerchange', ({ marker }) => console.log(marker));
// On unmount:
map.destroy();
map.element.remove();
```

Use `configure` for feature, layer, control and appearance changes; use `camera`
for viewport operations. Replace construction callbacks with `map.on` subscriptions.
For static-shell enhancement, call `mountGuideController(shell, options)` and keep
the returned controller for disposal.

## Site integrations

Pages builds require a v6-or-newer package and generate examples directly for that
contract. Older-package feature detection and flat-option fallback generation are
removed. Playground links must include `version: 1` in their design payload;
links produced by the current Share control already include it. Unversioned
handwritten links must add that field.
