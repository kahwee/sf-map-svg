import { createNeighborhoodExplorer } from './explorer.js';
import type { NeighborhoodExplorerOptions } from './types.js';
import { validateExplorerOptions } from './validation.js';

export type {
  CameraOptions,
  InteractiveLayers,
  MapFeatures,
  MapMarker,
  MapOverlay,
  MapPadding,
  MapViewport,
  NeighborhoodExplorerElement as InteractiveSFMapElement,
  NeighborhoodExplorerOptions as InteractiveSFMapOptions,
  NeighborhoodSelection,
} from './types.js';

/** Reusable browser map; plain basemap by default, no editorial UI or URL changes. */
export function createInteractiveSFMap(options: NeighborhoodExplorerOptions = {}) {
  validateExplorerOptions(options);
  return createNeighborhoodExplorer({ mode: 'basemap', ...options, interface: 'map' });
}
