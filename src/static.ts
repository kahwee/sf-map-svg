import { createSFMapWithData, getLayerPathsWithData, type SFMapData } from './map-core.js';
import type { SFMapOptions } from './types.js';

export type { DistrictRowData, SFMapData as StaticMapData } from './map-core.js';
export type { DistrictStyle, DistrictYear, SFMapOptions as StaticMapOptions } from './types.js';
/** Server-safe SVG rendering with explicit data; returns SVG plus projection helpers. */
export function renderMap(data: SFMapData, options: SFMapOptions = {}) {
  return createSFMapWithData(options, data);
}
/** Project canonical layer geometry without constructing an SVG string. */
export function getLayerPaths(data: SFMapData, options: SFMapOptions = {}) {
  return getLayerPathsWithData(options, data);
}
