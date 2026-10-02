import { prepareAppearance } from './appearance.js';
import { validateSwitchPatch } from './features.js';
import { createSFMapWithData, getLayerPathsWithData, type SFMapData } from './map-core.js';
import type { SFMapOptions } from './types.js';
import { assertOptions } from './validation.js';

export type { DistrictRowData, SFMapData as StaticMapData } from './map-core.js';
export type {
  DistrictStyle,
  DistrictYear,
  SFMapOptions as StaticMapOptions,
  StaticMapAppearance,
  StaticMapLayers,
} from './types.js';
/** Server-safe SVG rendering with explicit data; returns SVG plus projection helpers. */
export function renderMap(data: SFMapData, options: SFMapOptions = {}) {
  return createSFMapWithData(expandStaticOptions(options), data);
}
/** Project canonical layer geometry without constructing an SVG string. */
export function getLayerPaths(data: SFMapData, options: SFMapOptions = {}) {
  return getLayerPathsWithData(expandStaticOptions(options), data);
}

/** Grouped keys override flat compatibility keys; omitted keys preserve renderer defaults. */
function expandStaticOptions(options: SFMapOptions): SFMapOptions {
  assertOptions(options, 'static map');
  if (options.layers !== undefined)
    validateSwitchPatch(options.layers, [
      'districtFills',
      'districtLines',
      'districtLabels',
      'neighborhoodLines',
      'landmarks',
      'bartStations',
      'highways',
      'keyRoads',
      'roadLabels',
    ]);
  if (options.appearance !== undefined) {
    assertOptions(options.appearance, 'static appearance', ['theme', 'colors', 'districtStyle']);
  }
  const { layers, appearance, ...flat } = options;
  const supplied = (group: object = {}) =>
    Object.fromEntries(Object.entries(group).filter(([, value]) => value !== undefined));
  return {
    ...flat,
    ...supplied(layers),
    ...supplied(appearance === undefined ? undefined : prepareAppearance({}, appearance)),
  };
}
