import type { CameraOptions, MapViewport } from './types.js';
import { assertOptions } from './validation.js';
import { validateViewport } from './viewport.js';

export function validateCameraOptions(options: CameraOptions) {
  assertOptions(options, 'camera', ['animate', 'duration', 'fit']);
  if ('fit' in options && options.fit !== undefined && typeof options.fit !== 'boolean')
    throw new TypeError('fit must be boolean.');
  if (options.animate !== undefined && typeof options.animate !== 'boolean')
    throw new TypeError('animate must be a boolean.');
  if (
    options.duration !== undefined &&
    (!Number.isFinite(options.duration) || options.duration < 0)
  )
    throw new RangeError('Duration must be finite and nonnegative.');
}

/** A cancellable camera independent of DOM rendering; generation guards cover reentrant events. */
export function createCamera({
  read,
  write,
  duration,
  reduced,
  request,
  cancel,
  now,
}: {
  read: () => MapViewport;
  write: (view: MapViewport) => void;
  duration: () => number;
  reduced: () => boolean;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
  now: () => number;
}) {
  let frame = 0,
    generation = 0,
    destroyed = false;
  function stop() {
    generation++;
    cancel(frame);
    frame = 0;
  }
  return {
    stop,
    destroy() {
      destroyed = true;
      stop();
    },
    move(next: MapViewport, options: CameraOptions = {}) {
      if (destroyed) return;
      const target = validateViewport(next);
      validateCameraOptions(options);
      const ms = options.duration ?? (options.animate === true ? duration() || 320 : duration());
      stop();
      const token = generation;
      if (options.animate === false || reduced() || !ms) {
        write(target);
        return;
      }
      const from = [...read()],
        start = now();
      if (from.every((value, i) => value === target[i])) return;
      const tick: FrameRequestCallback = (time) => {
        if (destroyed || token !== generation) return;
        const t = Math.max(0, Math.min(1, (time - start) / ms));
        const eased = 1 - (1 - t) ** 3;
        write(
          target.map((value, i) => from[i] + (value - from[i]) * eased) as unknown as MapViewport,
        );
        if (destroyed || token !== generation) return;
        frame = t < 1 ? request(tick) : 0;
      };
      frame = request(tick);
    },
  };
}
