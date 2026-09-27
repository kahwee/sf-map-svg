import { createSFMapWithData, type SFMapData } from './map-core.js';
import type { SFMapOptions } from './types.js';

export type { SFMapData as StaticMapData } from './map-core.js';
export type { SFMapOptions as StaticMapOptions } from './types.js';
/** Server-safe SVG rendering with explicit data; returns SVG plus projection helpers. */
export function renderMap(data: SFMapData, options: SFMapOptions = {}) {
  return createSFMapWithData(options, data);
}
