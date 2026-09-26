import { createNeighborhoodExplorer } from './explorer.js';
import type { NeighborhoodExplorerOptions } from './types.js';

export type {
  InteractiveLayers,
  MapPadding,
  MapViewport,
  NeighborhoodExplorerElement as InteractiveSFMapElement,
  NeighborhoodExplorerOptions as InteractiveSFMapOptions,
  NeighborhoodSelection,
} from './types.js';

/** Reusable browser map; plain basemap by default, no editorial UI or URL changes. */
export function createInteractiveSFMap(options: NeighborhoodExplorerOptions = {}) {
  return createNeighborhoodExplorer({ mode: 'basemap', ...options, interface: 'map' });
}
