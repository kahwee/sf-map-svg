import type { MapAppearance } from './controller-types.js';
import { assertOptions, validateExplorerOptions } from './validation.js';

export const appearanceKeys = [
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

/** Copy configuration records without cloning or invoking styling callbacks. */
export function copyAppearance(value: MapAppearance = {}): MapAppearance {
  const { districtStyle, ...rest } = value;
  return { ...structuredClone(rest), ...(districtStyle ? { districtStyle } : {}) };
}
export function prepareAppearance(current: MapAppearance, patch: MapAppearance | undefined) {
  if (patch === undefined) return {};
  assertOptions(patch, 'appearance', appearanceKeys);
  const next = { ...current, ...patch };
  for (const key of ['colors', 'labelStyle', 'areaStyle', 'labelSize', 'style'] as const) {
    if (Object.hasOwn(patch, key) && patch[key] !== undefined) {
      assertOptions(patch[key], key);
      const tokens = { ...current[key], ...patch[key] };
      for (const name of Object.keys(tokens))
        if (tokens[name as keyof typeof tokens] === undefined)
          delete tokens[name as keyof typeof tokens];
      Object.assign(next, { [key]: tokens });
    }
  }
  for (const key of appearanceKeys) if (next[key] === undefined) delete next[key];
  validateExplorerOptions(next);
  if (next.theme !== undefined && !['districts', 'transit'].includes(next.theme))
    throw new TypeError('Theme must be districts or transit.');
  const min = next.labelSize?.min ?? 11,
    max = next.labelSize?.max ?? 12;
  const radius = next.markerRadius ?? 6,
    hit = next.markerHitSize ?? 44;
  if (
    ![min, max, radius, hit].every(Number.isFinite) ||
    min < 8 ||
    max < min ||
    max > 32 ||
    radius <= 0 ||
    hit < radius * 2
  )
    throw new RangeError(
      'Use label sizes from 8–32px and a positive marker radius inside its hit target.',
    );
  const weight = next.labelStyle?.fontWeight;
  if (weight !== undefined && (!Number.isFinite(weight) || weight < 1 || weight > 1000))
    throw new RangeError('Label font weight must be finite and between 1 and 1000.');
  return copyAppearance(next);
}
