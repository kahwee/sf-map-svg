import type { DistrictRowData } from './map-core.js';
import type { DistrictStyle, SFMapOptions } from './types.js';

/** Evaluate user code once and copy its result before changing the map. */
export function prepareDistrictStyles(
  rows: readonly DistrictRowData[],
  callback: SFMapOptions['districtStyle'],
): ReadonlyMap<number, DistrictStyle> {
  if (callback !== undefined && typeof callback !== 'function')
    throw new TypeError('districtStyle must be a function.');
  return new Map(rows.map((row) => [row.id, validateDistrictStyle(callback?.(row))]));
}

function validateDistrictStyle(style: DistrictStyle | undefined): DistrictStyle {
  if (style === undefined) return {};
  if (!style || typeof style !== 'object' || Array.isArray(style))
    throw new TypeError('districtStyle must return a style object.');
  for (const key of Object.keys(style))
    if (!['fill', 'stroke', 'opacity'].includes(key))
      throw new TypeError(`Unknown district style: ${key}`);
  const copy = { ...style };
  for (const key of ['fill', 'stroke'] as const)
    if (copy[key] !== undefined && typeof copy[key] !== 'string')
      throw new TypeError(`${key} must be a string.`);
  if (
    copy.opacity !== undefined &&
    (!Number.isFinite(copy.opacity) || copy.opacity < 0 || copy.opacity > 1)
  )
    throw new RangeError('District opacity must be between 0 and 1.');
  return copy;
}
