import test from 'node:test';
import assert from 'node:assert/strict';
import { interiorAnchor, fitBounds, clampView, layoutLabels } from '../src/explorer-layout.js';
import { createNeighborhoodExplorer } from '../src/explorer.js';

const ring = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
  [x1, y1],
];
const identity = (p) => p;

test('label anchors stay in filled geometry rather than holes or gaps between islands', () => {
  const donut = { type: 'Polygon', coordinates: [ring(0, 0, 10, 10), ring(2, 2, 8, 8)] };
  const [x, y] = interiorAnchor(donut, identity);
  assert(x > 0 && x < 10 && y > 0 && y < 10);
  assert(!(x > 2 && x < 8 && y > 2 && y < 8));
  const islands = {
    type: 'MultiPolygon',
    coordinates: [[ring(0, 0, 2, 2)], [ring(10, 10, 20, 20)]],
  };
  const point = interiorAnchor(islands, identity);
  assert(point[0] > 10 && point[0] < 20 && point[1] > 10 && point[1] < 20);
});

test('selection fits full bounds and zoom remains finite and within the map', () => {
  const bounds = [300, 500, 360, 620];
  const [x, y, size] = fitBounds(bounds);
  assert(x <= bounds[0] && y <= bounds[1]);
  assert(x + size >= bounds[2] && y + size >= bounds[3]);
  assert(size > 120);
  assert.deepEqual(clampView([-100, -100, 900]), [0, 0, 800]);
  const zoomed = clampView([799, 799, 1]);
  assert.equal(zoomed[2], 800 / 12);
  assert.equal(zoomed[0] + zoomed[2], 800);
  assert.equal(zoomed[1] + zoomed[2], 800);
});

test('screen labels prioritize selected areas, avoid collisions, and stay inside narrow viewports', () => {
  const labels = layoutLabels(
    [
      { id: 'selected', x: 100, y: 100, textWidth: 100 },
      { id: 'overlap', x: 105, y: 100, textWidth: 100 },
      { id: 'station', x: 360, y: 180, textWidth: 90, offset: 9 },
      { id: 'outside', x: -20, y: 0, textWidth: 80 },
    ],
    390,
    390,
  );
  assert.deepEqual(
    labels.map((x) => x.id),
    ['selected', 'station'],
  );
  assert(labels[1].left < 360, 'Station name switches to the left at the viewport edge');
  for (const { box } of labels)
    assert(box[0] >= 2 && box[1] >= 2 && box[2] <= 388 && box[3] <= 388);
  const [a, b] = labels.map((x) => x.box);
  assert(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]);
});

test('explorer module imports on the server but requires a document to mount', () => {
  assert.throws(() => createNeighborhoodExplorer(), /browser document/);
});
