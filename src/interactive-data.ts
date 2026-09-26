import { createNeighborhoodExplorerCore } from './explorer-core.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { NeighborhoodExplorerOptions } from './types.js';

export type { InteractiveSFMapData } from './explorer-data.js';
export type {
  InteractiveLayers,
  MapPadding,
  MapViewport,
  NeighborhoodExplorerElement as InteractiveSFMapElement,
  NeighborhoodExplorerOptions as InteractiveSFMapOptions,
  NeighborhoodSelection,
} from './types.js';

/** Browser map shell that bundles only the geography supplied by the caller. */
export function createInteractiveSFMapWithData(
  data: InteractiveSFMapData,
  options: NeighborhoodExplorerOptions = {},
) {
  return createNeighborhoodExplorerCore({ mode: 'basemap', ...options, interface: 'map' }, data);
}
