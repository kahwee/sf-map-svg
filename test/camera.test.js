import assert from 'node:assert/strict';
import test from 'node:test';
import { createCamera } from '../dist/src/camera.js';
import { clusterPoints } from '../dist/src/clusters.js';
import { normalizeFeatures } from '../dist/src/features.js';

function rig(onWrite = () => {}) {
  let view = [0, 0, 800],
    id = 0,
    time = 0,
    reduced = false;
  const queue = new Map();
  const camera = createCamera({
    read: () => view,
    write: (next) => {
      view = next;
      onWrite(camera);
    },
    duration: () => 100,
    reduced: () => reduced,
    request: (fn) => {
      queue.set(++id, fn);
      return id;
    },
    cancel: (key) => queue.delete(key),
    now: () => time,
  });
  return {
    camera,
    queue,
    view: () => view,
    reduce: () => {
      reduced = true;
    },
    tick(t) {
      time = t;
      const pending = [...queue.values()];
      queue.clear();
      for (const fn of pending) fn(t);
    },
  };
}
test('camera callbacks cannot reschedule after reentrant cancellation or destruction', () => {
  for (const action of ['stop', 'destroy']) {
    const r = rig((camera) => camera[action]());
    r.camera.move([200, 200, 400]);
    r.tick(50);
    assert.equal(r.queue.size, 0);
    const view = r.view();
    r.tick(100);
    assert.deepEqual(r.view(), view);
  }
});
test('new movement from a viewport callback supersedes the old timeline', () => {
  let replaced = false;
  const r = rig((camera) => {
    if (!replaced) {
      replaced = true;
      camera.move([50, 50, 600]);
    }
  });
  r.camera.move([200, 200, 400]);
  r.tick(50);
  assert.equal(r.queue.size, 1);
  r.tick(150);
  assert.deepEqual(r.view(), [50, 50, 600]);
  assert.equal(r.queue.size, 0);
});
test('invalid movement preserves pending work; explicit jumps and reduced motion are immediate', () => {
  const r = rig();
  r.camera.move([100, 100, 400]);
  assert.throws(() => r.camera.move([0, 0, 800], { duration: NaN }), /Duration/);
  assert.equal(r.queue.size, 1);
  r.camera.move([50, 50, 600], { animate: false });
  assert.equal(r.queue.size, 0);
  assert.deepEqual(r.view(), [50, 50, 600]);
  r.reduce();
  r.camera.move([0, 0, 800]);
  assert.deepEqual(r.view(), [0, 0, 800]);
  r.camera.destroy();
  r.camera.move([NaN, 0, 0]);
  assert.equal(r.queue.size, 0);
});
test('feature normalization validates JS inputs, copies options and preserves explicit zero values', () => {
  const input = { motion: { duration: 0 }, clustering: { radius: 20 }, selectedMarkerRing: true };
  const config = normalizeFeatures(input);
  input.clustering.radius = 900;
  assert.equal(config.clustering.radius, 20);
  assert.equal(config.motion.duration, 0);
  assert.equal(config.selectedMarkerRing.width, 2);
  for (const invalid of [
    { motion: null },
    { motion: 'yes' },
    { clustering: { radius: 0 } },
    { markerEntrance: { stagger: Infinity } },
    { northArrow: 1 },
    { unknown: true },
  ])
    assert.throws(() => normalizeFeatures(invalid));
  assert.equal(normalizeFeatures({ ...config, clustering: false }).clustering, false);
});
test('clusters are stable under input reordering and handle coincident and isolated points', () => {
  const items = Array.from({ length: 2000 }, (_, i) => ({
    marker: { id: String(i).padStart(4, '0') },
    point: [i < 1000 ? 0 : i * 50, 0],
  }));
  const ids = (groups) => groups.map((group) => group.map((item) => item.marker.id));
  const groups = clusterPoints(items, 1, 32);
  assert.equal(groups.length, 1001);
  assert.equal(groups[0].length, 1000);
  assert.deepEqual(ids(clusterPoints([...items].reverse(), 1, 32)), ids(groups));
  assert.throws(() => clusterPoints(items, 0, 32), /Cluster/);
});

test('misspelled nested options and non-record feature objects are rejected', () => {
  for (const value of [
    { motion: { duraton: 1 } },
    { clustering: new Date() },
    { markerEntrance: { delay: 30 } },
    { selectedMarkerRing: { colour: 'red' } },
  ])
    assert.throws(() => normalizeFeatures(value));
});
