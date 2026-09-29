import type { SFMapOptions } from './types.js';
import { assertOptions } from './validation.js';

/** Reference choreography length; `duration` rescales every step proportionally. */
const REFERENCE = 2400;

export interface StaticAnimation {
  duration: number;
  delay: number;
}

/** Validate `animation` and return timings, or null when animation is off. */
export function normalizeStaticAnimation(value: SFMapOptions['animation']): StaticAnimation | null {
  if (value === undefined || value === false) return null;
  if (value === true) return { duration: REFERENCE, delay: 0 };
  assertOptions(value, 'animation', ['duration', 'delay']);
  const { duration = REFERENCE, delay = 0 } = value;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0)
    throw new RangeError('Animation duration must be a positive finite number.');
  if (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0)
    throw new RangeError('Animation delay must be a nonnegative finite number.');
  return { duration, delay };
}

/**
 * Scoped, self-contained CSS for an animated static map. It runs when the SVG is
 * inserted into a page or loaded as an image, and stays still under reduced motion.
 * Line layers carry `pathLength="1"` so a single dash can draw them on.
 */
export function staticAnimationStyle(idPrefix: string, { duration, delay }: StaticAnimation) {
  const scale = duration / REFERENCE;
  const time = (ms: number) => `${Math.round(ms * scale)}ms`;
  const at = (ms: number, step?: number) =>
    step === undefined
      ? `${Math.round(delay + ms * scale)}ms`
      : `calc(${Math.round(delay + ms * scale)}ms + var(--i,0) * ${Math.round(step * scale)}ms)`;
  const scope = `[data-sf-animate="${idPrefix}"]`;
  const out = 'cubic-bezier(.16,1,.3,1)';
  const inOut = 'cubic-bezier(.65,0,.35,1)';
  const fade = `${idPrefix}-fade`;
  const draw = `${idPrefix}-draw`;
  const grow = `${idPrefix}-grow`;
  return `<style>@keyframes ${fade}{from{opacity:0}}@keyframes ${draw}{from{stroke-dashoffset:1}}@keyframes ${grow}{from{opacity:0;transform:scale(.86)}}${scope} [data-layer="coast"]{animation:${fade} ${time(700)} ${out} ${at(0)} both}${scope} [data-layer="coastline"],${scope} [data-layer="district-lines"] path,${scope} [data-layer="highways"] path,${scope} [data-layer="key-roads"] path,${scope} [data-overlay-id]{stroke-dasharray:1}${scope} [data-layer="coastline"]{animation:${draw} ${time(1500)} ${inOut} ${at(0)} both}${scope} [data-layer="district-fills"] path{transform-box:fill-box;transform-origin:center;animation:${grow} ${time(800)} ${out} ${at(300, 60)} both}${scope} [data-layer="landmarks"]{animation:${fade} ${time(700)} ${out} ${at(900)} both}${scope} [data-layer="key-roads"] path,${scope} [data-layer="highways"] path{animation:${draw} ${time(1100)} ${inOut} ${at(1000)} both}${scope} [data-layer="neighborhood-lines"] path{animation:${fade} ${time(500)} ${out} ${at(1100, 7)} both}${scope} [data-layer="district-lines"] path{animation:${draw} ${time(1000)} ${inOut} ${at(1150, 45)} both}${scope} [data-overlay-id]{animation:${draw} ${time(1000)} ${inOut} ${at(1500)} both}${scope} [data-layer$="-labels"]{animation:${fade} ${time(600)} ${out} ${at(1850)} both}${scope} [data-bart-station]>circle,${scope} [data-marker-id]{transform-box:fill-box;transform-origin:center;animation:${grow} ${time(500)} ${out} ${at(1900, 70)} both}${scope} [data-bart-station]>text{animation:${fade} ${time(500)} ${out} ${at(2000, 70)} both}@media (prefers-reduced-motion:reduce){${scope} *{animation:none!important}}</style>`;
}
