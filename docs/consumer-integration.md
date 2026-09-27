# Consumer integration

Use the version 3 root controller and explicit geographic data. The [migration guide](migration-v3.md) maps removed imports to supported calls.

For a compact browser guide:

```ts
import { createMap } from '@kahwee/sf-map-svg';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';
import { guideOptions } from '@kahwee/sf-map-svg/presets';

const map = createMap(guideMapData, { ...guideOptions });
document.querySelector('#map')?.append(map.element);
// Dispose when the containing view unmounts.
map.destroy();
```

For server rendering, import `renderMap` from the root and pass `guideMapData.map`, `staticMapData` from `/data/static`, or another explicit `StaticMapData`. Import `/data/full` when interactive lookup collections are also required. All rendering stays offline and has zero runtime dependencies. The guide's detailed geography loads only when `loadGuideDetailedData()` is called.
