import assert from 'node:assert/strict';
import test from 'node:test';
import { attachNavigation } from '../dist/src/navigation.js';
import { validateViewport } from '../dist/src/viewport.js';

class Surface extends EventTarget {
  captured = new Set();
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 400 };
  }
}
function fire(target, name, properties) {
  const event = new Event(name, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

test('touch policy, anchored pinch, pointer cancellation, resize reset and teardown', () => {
  const previous = globalThis.window;
  globalThis.window = new EventTarget();
  const svg = new Surface();
  const controller = new AbortController();
  let view = [200, 200, 400];
  const navigation = attachNavigation(
    svg,
    () => [...view],
    (next) => {
      view = validateViewport(next);
    },
    controller.signal,
    () => navigation.setTouchNavigation(false),
  );
  const pointer = (target, type, id, x, y) =>
    fire(target, type, { button: 0, pointerType: 'touch', pointerId: id, clientX: x, clientY: y });
  try {
    pointer(svg, 'pointerdown', 1, 100, 200);
    pointer(window, 'pointermove', 1, 130, 200);
    assert.deepEqual(view, [200, 200, 400], 'Default leaves touch to page');
    navigation.setTouchNavigation(true);
    pointer(svg, 'pointerdown', 1, 100, 200);
    pointer(svg, 'pointerdown', 2, 300, 200);
    pointer(window, 'pointermove', 1, 50, 200);
    const transfer = new Event('lostpointercapture');
    Object.defineProperty(transfer, 'target', { value: new Surface() });
    Object.assign(transfer, { pointerId: 1 });
    svg.dispatchEvent(transfer); // A descendant's implicit capture transfers to the SVG.
    assert(svg.hasPointerCapture(1), 'Transfer must not release the newly captured pointer');
    pointer(window, 'pointermove', 2, 350, 200);
    assert(Math.abs(view[2] - 400 / 1.5) < 1e-9);
    assert(Math.abs(view[0] + view[2] / 2 - 400) < 1e-9, 'Pinch preserves anchor');
    pointer(window, 'pointercancel', 1, 50, 200);
    const canceled = [...view];
    pointer(window, 'pointermove', 2, 390, 300);
    assert.deepEqual(view, canceled);
    assert.equal(svg.captured.size, 0);
    pointer(svg, 'pointerdown', 3, 200, 200);
    pointer(window, 'pointermove', 3, 180, 200);
    assert(view[0] > canceled[0], 'Pan works after cancellation');
    navigation.cancel(); // ResizeObserver uses the same cancellation path.
    const resized = [...view];
    pointer(window, 'pointermove', 3, 100, 200);
    assert.deepEqual(view, resized);
    controller.abort();
    fire(svg, 'keydown', { key: '+' });
    assert.deepEqual(view, resized);
  } finally {
    controller.abort();
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
