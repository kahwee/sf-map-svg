import { prepareAppearance } from './appearance.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { validateSwitchPatch } from './features.js';
import { createSFMapWithData, getLayerPathsWithData, type SFMapData } from './map-core.js';
import type { SFMapOptions } from './types.js';
import { assertOptions } from './validation.js';

/** Either compact static geography or the same source-aware geography used by createMap. */
export type StaticMapInput = SFMapData | InteractiveSFMapData;

export type { DistrictRowData, SFMapData as StaticMapData } from './map-core.js';
export type {
  DistrictStyle,
  DistrictYear,
  SFMapOptions as StaticMapOptions,
  StaticMapAppearance,
  StaticMapLayers,
} from './types.js';
/** Server-safe SVG rendering with explicit data; returns SVG plus projection helpers. */
export function renderMap(data: StaticMapInput, options: SFMapOptions = {}) {
  const prepared = expandStaticOptions(options);
  return createSFMapWithData(prepared, staticInput(data, prepared));
}
/** Project canonical layer geometry without constructing an SVG string. */
export function getLayerPaths(data: StaticMapInput, options: SFMapOptions = {}) {
  const prepared = expandStaticOptions(options);
  return getLayerPathsWithData(prepared, staticInput(data, prepared));
}

/** Borrow immutable geometry, deriving only the renderer's lightweight neighborhood rows. */
function staticInput(data: StaticMapInput, options: SFMapOptions): SFMapData {
  if (options.source !== undefined && !['realtor', 'sf-find', 'analysis'].includes(options.source))
    throw new RangeError('Unknown neighborhood source.');
  if (!('map' in data)) {
    if (options.source !== undefined)
      throw new TypeError(
        'source requires source-aware MapData; compact StaticMapData already chooses its geography.',
      );
    return data;
  }
  const source =
    options.source ??
    (['realtor', 'sf-find', 'analysis'] as const).find(
      (candidate) => !!data.neighborhoods[candidate],
    );
  if (source === undefined) return data.map;
  const collection = data.neighborhoods[source];
  if (!collection) throw new RangeError(`No ${source} neighborhood dataset was supplied.`);
  return {
    ...data.map,
    neighborhoods: collection.features.map(({ geometry, properties }) => ({
      name: properties.sourceName,
      geometry,
    })),
  };
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
