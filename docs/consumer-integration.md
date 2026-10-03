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

## Enhance the existing frame

In your browser entry, mount the controller into that shell:

```ts
import { mountGuideController } from '@kahwee/sf-map-svg/guide';

const shell = document.querySelector<HTMLElement>('.sf-guide-shell');
if (!shell) throw new Error('Missing guide shell');
const guide = mountGuideController(shell, {
  attribution: 'compact',
  features: { motion: { duration: 400 }, markerEntrance: true },
  appearance: { theme: 'transit' },
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
