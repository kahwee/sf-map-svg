import { prepareAppearance } from './appearance.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { validateSwitchPatch } from './features.js';
import { createSFMapWithData, getLayerPathsWithData, type SFMapData } from './map-core.js';
import { normalizeStaticAnimation } from './static-animation.js';
import { staticLabels } from './static-labels.js';
import type { SFMapOptions } from './types.js';
import { assertOptions, validateMarkers, validateOverlays } from './validation.js';

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
  const { map, source } = staticInput(data, prepared);
  return createSFMapWithData(
    { ...prepared, source },
    map,
    prepared.labelLayout ? (project) => staticLabels(map, prepared, project) : undefined,
  );
}
/** Project canonical layer geometry without constructing an SVG string. */
export function getLayerPaths(data: StaticMapInput, options: SFMapOptions = {}) {
  const prepared = expandStaticOptions(options);
  return getLayerPathsWithData(prepared, staticInput(data, prepared).map);
}

/** Borrow immutable geometry, deriving only the renderer's lightweight neighborhood rows. */
function staticInput(data: StaticMapInput, options: SFMapOptions) {
  if (options.source !== undefined && !['realtor', 'sf-find', 'analysis'].includes(options.source))
    throw new RangeError('Unknown neighborhood source.');
  if (!('map' in data)) {
    if (options.source !== undefined)
      throw new TypeError(
        'source requires source-aware MapData; compact StaticMapData already chooses its geography.',
      );
    return { map: data, source: undefined };
  }
  const source =
    options.source ??
    (['realtor', 'sf-find', 'analysis'] as const).find(
      (candidate) => !!data.neighborhoods[candidate],
    );
  if (source === undefined) return { map: data.map, source: undefined };
  const collection = data.neighborhoods[source];
  if (!collection) throw new RangeError(`No ${source} neighborhood dataset was supplied.`);
  return {
    source,
    map: {
      ...data.map,
      neighborhoods: collection.features.map(({ id, geometry, properties }) => ({
        id,
        name: options.labelLayout ? properties.canonicalName : properties.sourceName,
        geometry,
      })),
    },
  };
}

const staticLayerKeys = [
  'districtFills',
  'districtLines',
  'districtLabels',
  'neighborhoodLines',
  'neighborhoodLabels',
  'landmarks',
  'bartStations',
  'highways',
  'keyRoads',
  'roadLabels',
] as const satisfies readonly (keyof SFMapOptions)[];

/** Grouped keys override flat compatibility keys; omitted keys preserve renderer defaults. */
function expandStaticOptions(options: SFMapOptions): SFMapOptions {
  assertOptions(options, 'static map', [
    ...staticLayerKeys,
    'layers',
    'appearance',
    'theme',
    'colors',
    'districtStyle',
    'width',
    'height',
    'padding',
    'year',
    'source',
    'labels',
    'labelLayout',
    'markers',
    'overlays',
    'title',
    'idPrefix',
    'animation',
  ] satisfies readonly (keyof SFMapOptions)[]);
  for (const key of [...staticLayerKeys, 'labels'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'boolean')
      throw new TypeError(`${key} must be boolean.`);
  for (const key of ['title', 'idPrefix'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'string')
      throw new TypeError(`${key} must be a string.`);
  if (options.labelLayout !== undefined) {
    assertOptions(options.labelLayout, 'label layout', [
      'width',
      'maxLabels',
      'haloColor',
      'compact',
    ]);
    if (!Number.isFinite(options.labelLayout.width) || options.labelLayout.width <= 0)
      throw new RangeError('Invalid label layout width.');
    const { maxLabels, haloColor, compact } = options.labelLayout;
    if (maxLabels !== undefined && (!Number.isSafeInteger(maxLabels) || maxLabels < 0))
      throw new RangeError('Invalid maxLabels.');
    if (haloColor !== undefined && typeof haloColor !== 'string')
      throw new TypeError('haloColor must be a string.');
    if (compact !== undefined) {
      assertOptions(compact, 'compact label layout', ['width', 'maxLabels']);
      if (
        !Number.isFinite(compact.width) ||
        compact.width <= 0 ||
        compact.width >= options.labelLayout.width
      )
        throw new RangeError('Invalid compact width.');
      if (!Number.isSafeInteger(compact.maxLabels) || compact.maxLabels < 0)
        throw new RangeError('Invalid maxLabels.');
    }
  }
  if (options.markers !== undefined) validateMarkers(options.markers);
  if (options.overlays !== undefined) validateOverlays(options.overlays);
  normalizeStaticAnimation(options.animation);
  if (options.layers !== undefined) validateSwitchPatch(options.layers, staticLayerKeys);
  if (options.appearance !== undefined) {
    assertOptions(options.appearance, 'static appearance', ['theme', 'colors', 'districtStyle']);
  }
  const { layers, appearance, theme, colors, districtStyle, ...flat } = options;
  const supplied = (group: object = {}) =>
    Object.fromEntries(Object.entries(group).filter(([, value]) => value !== undefined));
  return {
    ...flat,
    ...prepareAppearance({}, { theme, colors, districtStyle }),
    ...supplied(layers),
    ...supplied(appearance === undefined ? undefined : prepareAppearance({}, appearance)),
  };
}
