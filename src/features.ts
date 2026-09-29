import type { MapFeatures } from './types.js';
import { assertOptions } from './validation.js';

function objectOption(value: unknown, name: string): Record<string, unknown> | false {
  if (value === undefined || value === false) return false;
  if (value === true) return {};
  assertOptions(
    value,
    name,
    name === 'motion' || name === 'layerTransitions' || name === 'districtMorph'
      ? ['duration']
      : name === 'markerEntrance'
        ? ['duration', 'stagger']
        : name === 'clustering'
          ? ['radius']
          : ['color', 'width', 'gap'],
  );
  return value as Record<string, unknown>;
}
function numberOption(value: unknown, fallback: number, name: string, positive = false) {
  const result = value === undefined ? fallback : value;
  if (
    typeof result !== 'number' ||
    !Number.isFinite(result) ||
    (positive ? result <= 0 : result < 0)
  )
    throw new RangeError(`${name} must be finite and ${positive ? 'positive' : 'nonnegative'}.`);
  return result;
}
function flag(value: unknown, name: string) {
  if (value !== undefined && typeof value !== 'boolean')
    throw new TypeError(`${name} must be a boolean.`);
  return value ?? false;
}

/** One normalization boundary shared by construction and atomic runtime patches. */
export function normalizeFeatures(input: MapFeatures = {}) {
  assertOptions(input, 'features');
  const keys = [
    'motion',
    'markerEntrance',
    'clustering',
    'selectedMarkerRing',
    'northArrow',
    'scaleBar',
    'layerTransitions',
    'districtMorph',
  ];
  for (const key of Object.keys(input))
    if (!keys.includes(key)) throw new TypeError(`Unknown feature: ${key}`);
  const motion = objectOption(input.motion, 'motion');
  const entrance = objectOption(input.markerEntrance, 'markerEntrance');
  const clustering = objectOption(input.clustering, 'clustering');
  const ring = objectOption(input.selectedMarkerRing, 'selectedMarkerRing');
  const layerTransitions = objectOption(input.layerTransitions, 'layerTransitions');
  const districtMorph = objectOption(input.districtMorph, 'districtMorph');
  if (ring && ring.color !== undefined && typeof ring.color !== 'string')
    throw new TypeError('Ring color must be a string.');
  return {
    motion: motion && { duration: numberOption(motion.duration, 320, 'Motion duration') },
    markerEntrance: entrance && {
      duration: numberOption(entrance.duration, 420, 'Entrance duration'),
      stagger: numberOption(entrance.stagger, 35, 'Entrance stagger'),
    },
    clustering: clustering && {
      radius: numberOption(clustering.radius, 32, 'Cluster radius', true),
    },
    selectedMarkerRing: ring && {
      color: ring.color as string | undefined,
      width: numberOption(ring.width, 2, 'Ring width'),
      gap: numberOption(ring.gap, 3, 'Ring gap'),
    },
    northArrow: flag(input.northArrow, 'northArrow'),
    scaleBar: flag(input.scaleBar, 'scaleBar'),
    layerTransitions: layerTransitions && {
      duration: numberOption(layerTransitions.duration, 360, 'Layer transition duration'),
    },
    districtMorph: districtMorph && {
      duration: numberOption(districtMorph.duration, 1100, 'District morph duration', true),
    },
  };
}

export const layerKeys = [
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
] as const;
export const controlKeys = [
  'zoom',
  'pan',
  'reset',
  'labels',
  'touch',
  'legend',
  'neighborhoodPicker',
  'markerPicker',
  'help',
  'status',
] as const;

export function validateSwitchPatch(patch: unknown, keys: readonly string[]) {
  const record = assertOptions(patch, 'switches');
  for (const [key, value] of Object.entries(record)) {
    if (!keys.includes(key)) throw new TypeError(`Unknown switch: ${key}`);
    if (value !== undefined && typeof value !== 'boolean')
      throw new TypeError(`${key} must be boolean.`);
  }
}
