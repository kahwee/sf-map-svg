import { guideMapData } from '../src/guide-data.js';
import { createMapEngine } from '../src/interactive/map-engine.js';
import { createMapShell } from '../src/interactive/map-shell.js';
import { guideOptions } from '../src/presets.js';
import type { NeighborhoodExplorerOptions } from '../src/types.js';

/** Low-level fixture for engine lifecycle tests; public integrations use MapController. */
export function createGuideTestEngine(options: NeighborhoodExplorerOptions = {}) {
  return createMapEngine(
    {
      mode: 'neighborhoods',
      ...options,
      layers: { ...guideOptions.layers, ...options.layers },
      interface: 'map',
    },
    guideMapData,
    { createShell: createMapShell },
  );
}
