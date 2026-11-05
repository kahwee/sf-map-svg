import type { InteractiveSFMapData } from '../explorer-data.js';
import { controlKeys, layerKeys, normalizeFeatures, validateSwitchPatch } from '../features.js';
import type { NeighborhoodExplorerOptions } from '../types.js';
import { validateExplorerOptions } from '../validation.js';
import { createNeighborhoodLookup } from './neighborhood-layer.js';

/** Validate and copy initial configuration before creating DOM or registering listeners. */
export function prepareMapOptions(
  options: NeighborhoodExplorerOptions,
  data: InteractiveSFMapData,
) {
  validateExplorerOptions(options);
  let {
    source = 'realtor',
    mode = 'neighborhoods',
    labels = true,
    neighborhood,
    year = 2022,
    theme = 'transit',
    colors = {},
    labelStyle = {},
    areaStyle = {},
    districtStyle: initialDistrictStyle,
    motion = false,
    markerEntrance = false,
    selectedMarkerRing,
    clustering = false,
    legend: legendOptions = {},
    attribution: attributionMode = 'full',
    northArrow = false,
    scaleBar = false,
    layerTransitions = false,
    districtMorph: districtMorphOption = false,
    interface: chrome = 'explorer',
    layers = {},
    selectableNeighborhoods = true,
    labelSize = {},
    fitPadding = 24,
    markers: initialMarkers = [],
    markerRadius = 6,
    markerHitSize = 44,
    markerColor = colors.marker ?? '#245b61',
    selectedMarkerColor = colors.selected ?? '#f04f32',
    onMarkerActivate,
    overlays: initialOverlays = [],
    onOverlayActivate,
    style: styleOptions = {},
    strings = {},
    controls = {},
  } = options;
  if (!['neighborhoods', 'districts', 'basemap'].includes(mode))
    throw new RangeError(`Unknown map mode: ${mode}`);
  if (chrome !== 'explorer' && chrome !== 'map') throw new RangeError('Unknown interface.');
  const minLabelSize = labelSize.min ?? 11,
    maxLabelSize = labelSize.max ?? 12;
  if (
    ![minLabelSize, maxLabelSize, markerRadius, markerHitSize].every(Number.isFinite) ||
    minLabelSize < 8 ||
    maxLabelSize < minLabelSize ||
    maxLabelSize > 32 ||
    markerRadius <= 0 ||
    markerHitSize < markerRadius * 2
  )
    throw new RangeError(
      'Use label sizes from 8–32px and a positive marker radius inside its hit target.',
    );
  const features = normalizeFeatures({
    motion,
    markerEntrance,
    clustering,
    selectedMarkerRing,
    northArrow,
    scaleBar,
    layerTransitions,
    districtMorph: districtMorphOption,
  });
  if (
    labelStyle.fontWeight !== undefined &&
    (!Number.isFinite(labelStyle.fontWeight) ||
      labelStyle.fontWeight < 1 ||
      labelStyle.fontWeight > 1000)
  )
    throw new RangeError('Label font weight must be finite and between 1 and 1000.');
  validateSwitchPatch(controls, controlKeys);
  colors = { ...colors };
  labelStyle = { ...labelStyle };
  areaStyle = { ...areaStyle };
  strings = { ...strings };
  controls = { ...controls };
  if (typeof fitPadding === 'object') fitPadding = { ...fitPadding };
  validateSwitchPatch(layers, layerKeys);
  validateSwitchPatch(controls, controlKeys);
  layers = { ...layers };
  if (typeof labels !== 'boolean') throw new TypeError('Labels must be a boolean.');
  const collections = data.neighborhoods;
  const sources = (['realtor', 'sf-find', 'analysis'] as const).filter((item) =>
    Object.hasOwn(collections, item),
  );
  if (options.source === undefined && sources.length && !Object.hasOwn(collections, source))
    source = sources[0];
  if (!Object.hasOwn(collections, source) && (sources.length || options.source !== undefined))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
  if (!sources.length && mode === 'neighborhoods')
    throw new RangeError('No neighborhood dataset was supplied.');
  if (neighborhood === '') neighborhood = undefined;
  const { getNeighborhood, searchNeighborhoods } = createNeighborhoodLookup(collections);
  if (neighborhood !== undefined && !getNeighborhood(neighborhood, source))
    throw new RangeError(`Unknown neighborhood: ${neighborhood}`);
  return {
    source,
    mode,
    labels,
    neighborhood,
    year,
    theme,
    colors,
    labelStyle,
    areaStyle,
    initialDistrictStyle,
    legendOptions,
    attributionMode,
    chrome,
    layers,
    selectableNeighborhoods,
    fitPadding,
    initialMarkers,
    markerRadius,
    markerHitSize,
    markerColor,
    selectedMarkerColor,
    onMarkerActivate,
    initialOverlays,
    onOverlayActivate,
    styleOptions,
    strings,
    controls,
    minLabelSize,
    maxLabelSize,
    features,
    collections,
    sources,
    getNeighborhood,
    searchNeighborhoods,
  };
}
