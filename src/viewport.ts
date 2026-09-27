import type { Bounds } from '../data/types.js';
import { clampView } from './explorer-layout.js';
import type { MapPadding, MapViewport } from './types.js';
import { validatePadding } from './validation.js';

export function validateViewport(view: MapViewport) {
  if (
    !Array.isArray(view) ||
    view.length !== 3 ||
    !Array.from(view).every(Number.isFinite) ||
    view[2] <= 0
  )
    throw new RangeError('Viewport must contain finite x, y, and a positive size.');
  return clampView([view[0], view[1], view[2]]);
}

/** Fit bounds in the unobscured screen area, then constrain to the city extent. */
export function fitViewport(bounds: Bounds, width: number, padding: number | MapPadding = 24) {
  validatePadding(padding);
  if (!Array.isArray(bounds) || bounds.length !== 4 || !Array.from(bounds).every(Number.isFinite))
    throw new RangeError('Fit requires four finite bounds.');
  const p =
    typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const { top = 0, right = 0, bottom = 0, left = 0 } = p;
  if (
    ![width, top, right, bottom, left, ...bounds].every(Number.isFinite) ||
    Math.min(top, right, bottom, left) < 0 ||
    width <= left + right ||
    width <= top + bottom ||
    bounds[0] > bounds[2] ||
    bounds[1] > bounds[3]
  )
    throw new RangeError(
      'Fit requires nonempty finite geometry and padding smaller than the viewport.',
    );
  const size = Math.max(
    800 / 12,
    Math.min(800, ((bounds[2] - bounds[0]) * width) / (width - left - right)),
  );
  const fittedSize = Math.max(
    size,
    Math.min(800, ((bounds[3] - bounds[1]) * width) / (width - top - bottom)),
  );
  return clampView([
    (bounds[0] + bounds[2]) / 2 - fittedSize / 2 - ((left - right) * fittedSize) / width / 2,
    (bounds[1] + bounds[3]) / 2 - fittedSize / 2 - ((top - bottom) * fittedSize) / width / 2,
    fittedSize,
  ]);
}
