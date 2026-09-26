import assert from 'node:assert/strict';
import test from 'node:test';
import { createInteractiveSFMap } from '../dist/src/interactive.js';
import { fitViewport, validateViewport } from '../dist/src/viewport.js';

test('viewport restore clamps safely and rejects invalid state', () => {
  assert.deepEqual(validateViewport([200, 200, 400]), [200, 200, 400]);
  assert.deepEqual(validateViewport([-10, 900, 800]), [0, 0, 800]);
  for (const view of [
    [0, 0, 0],
    [NaN, 0, 800],
    [0, Infinity, 800],
    [0, 0],
  ])
    assert.throws(() => validateViewport(view), /Viewport/);
});

test('asymmetric fit padding places all bounds inside the free screen region', () => {
  const bounds = [250, 260, 500, 470];
  const padding = { left: 30, right: 90, top: 25, bottom: 70 };
  for (const width of [390, 1000]) {
    const [x, y, size] = fitViewport(bounds, width, padding);
    const screen = [
      ((bounds[0] - x) / size) * width,
      ((bounds[1] - y) / size) * width,
      ((bounds[2] - x) / size) * width,
      ((bounds[3] - y) / size) * width,
    ];
    assert(screen[0] >= padding.left - 1e-9 && screen[1] >= padding.top - 1e-9);
    assert(screen[2] <= width - padding.right + 1e-9 && screen[3] <= width - padding.bottom + 1e-9);
  }
});

test('point fitting caps zoom, invalid bounds and impossible padding fail', () => {
  assert.equal(fitViewport([400, 400, 400, 400], 390)[2], 800 / 12);
  for (const bounds of [
    [Infinity, 0, 0, 0],
    [400, 400, 200, 200],
  ])
    assert.throws(() => fitViewport(bounds, 390), /Fit requires/);
  for (const padding of [-1, 200, { left: 400 }, NaN])
    assert.throws(() => fitViewport([300, 300, 400, 400], 390, padding), /Fit requires/);
});

test('interactive entry point imports without a browser and validates label ranges', () => {
  assert.throws(() => createInteractiveSFMap(), /browser document/);
  assert.throws(() => createInteractiveSFMap({ labelSize: { min: 16, max: 12 } }), /label sizes/);
});
