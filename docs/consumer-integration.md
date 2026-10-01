# Consumer integration

Use the root controller and import geographic data explicitly. The [migration guide](migration-v3.md) maps removed v2 imports to supported calls.

For a compact browser guide:

```ts
import { createGuideController } from '@kahwee/sf-map-svg/guide';

const map = createGuideController({
  features: { motion: { duration: 400 }, markerEntrance: true },
  appearance: { theme: 'transit' },
});
document.querySelector('#map')?.append(map.element);
// Dispose when the containing view unmounts.
map.destroy();
```

The guide controller uses the same `configure()`, `camera`, `on()`, and `destroy()` contract as `createMap()`. Motion is opt-in and follows the user's reduced-motion preference. For explicit data composition, `createMap(guideMapData, guideOptions)` remains available using `/guide/data` and `/presets`.

To progressively enhance server-rendered `createGuideShell()` markup, use `mountGuideController(shell, options)` from `/guide`. It returns the controller and requires compact attribution. Invalid configuration leaves the static frame intact. Destroy the controller when unmounting. Existing `createGuideMap()` and `mountGuideMap()` return their original augmented elements and accept flat options for compatibility.

For server rendering, import `renderMap` from the root and pass `guideMapData.map`, `staticMapData` from `/data/static`, or another explicit `StaticMapData`. Import `/data/full` when interactive lookup collections are also required. All rendering stays offline and has zero runtime dependencies. The guide's detailed geography loads only when `loadGuideDetailedData()` is called.
