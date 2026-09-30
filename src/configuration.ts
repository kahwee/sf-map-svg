import type { MapConfiguration, MapConfigurationSnapshot, MapOptions } from './controller-types.js';
import { controlKeys, layerKeys, normalizeFeatures, validateSwitchPatch } from './features.js';
import type { NeighborhoodExplorerOptions } from './types.js';
import { assertOptions, validateExplorerOptions } from './validation.js';

const appearanceKeys = [
  'theme',
  'colors',
  'labelStyle',
  'areaStyle',
  'districtStyle',
  'labelSize',
  'style',
  'markerRadius',
  'markerHitSize',
  'markerColor',
  'selectedMarkerColor',
] as const;
const featureKeys = [
  'motion',
  'markerEntrance',
  'selectedMarkerRing',
  'clustering',
  'northArrow',
  'scaleBar',
  'layerTransitions',
  'districtMorph',
];

export function expandMapOptions(options: MapOptions): NeighborhoodExplorerOptions {
  const record = assertOptions(options, 'map');
  for (const key of [
    ...appearanceKeys,
    ...featureKeys,
    'interface',
    'onMarkerActivate',
    'onOverlayActivate',
  ])
    if (key in record) {
      const replacement = appearanceKeys.includes(key as (typeof appearanceKeys)[number])
        ? `appearance.${key}`
        : featureKeys.includes(key)
          ? `features.${key}`
          : key === 'onMarkerActivate'
            ? "map.on('markerchange', listener)"
            : key === 'onOverlayActivate'
              ? "map.on('overlayactivate', listener)"
              : null;
      throw new TypeError(
        replacement
          ? `Use ${replacement} instead of the flat ${key} option.`
          : 'interface is internal and is not a supported createMap option.',
      );
    }
  if (options.appearance !== undefined)
    assertOptions(options.appearance, 'appearance', appearanceKeys);
  if (options.features !== undefined) normalizeFeatures(options.features);
  const { features, appearance, ...rest } = options;
  const expanded = { ...rest, ...appearance, ...features };
  validateExplorerOptions(expanded);
  return expanded;
}

/** Prepare the entire configuration before any DOM mutation. */
export function prepareConfiguration(
  current: MapConfigurationSnapshot,
  patch: MapConfiguration,
): MapConfigurationSnapshot {
  assertOptions(patch, 'configuration', ['features', 'layers', 'controls']);
  const features =
    'features' in patch
      ? normalizeFeatures(
          patch.features === undefined
            ? {}
            : { ...current.features, ...checkedFeatures(patch.features) },
        )
      : current.features;
  const switches = <T extends object>(
    key: 'layers' | 'controls',
    previous: T,
    keys: readonly string[],
  ): T => {
    if (!(key in patch)) return previous;
    const value = patch[key];
    if (value === undefined) return {} as T;
    validateSwitchPatch(value, keys);
    const next = { ...previous, ...value };
    for (const property of Object.keys(next))
      if (next[property as keyof T] === undefined) delete next[property as keyof T];
    return next;
  };
  return structuredClone({
    features,
    layers: switches('layers', current.layers, layerKeys),
    controls: switches('controls', current.controls, controlKeys),
  });
}
function checkedFeatures(value: NonNullable<MapConfiguration['features']>) {
  normalizeFeatures(value);
  return value;
}
