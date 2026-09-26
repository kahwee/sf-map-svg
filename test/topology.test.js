import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import polygonClipping from 'polygon-clipping';
import realtor from '../data/neighborhoods-realtor.json' with { type: 'json' };
import digests from './fixtures/geometry-digests.json' with { type: 'json' };
import { findOverlaps, removeOverlaps } from '../scripts/lib/topology.js';

const rectangle = (id, x1, y1, x2, y2) => ({
  type: 'Feature',
  id,
  bbox: [x1, y1, x2, y2],
  properties: { name: id },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
          [x1, y1],
        ],
      ],
    ],
  },
});
test('realtor neighborhoods have no overlapping interiors or overlapping polygon parts', () => {
  assert.equal(realtor.features.length, 92);
  assert.deepEqual(findOverlaps(realtor.features), []);
  for (const feature of realtor.features) {
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (let i = 0; i < polygons.length; i++)
      for (let j = i + 1; j < polygons.length; j++) {
        assert.deepEqual(polygonClipping.intersection(polygons[i], polygons[j]), [], feature.id);
      }
  }
});
test('topology repair preserves the original combined footprint and is idempotent', () => {
  const union = polygonClipping.union(...realtor.features.map((f) => f.geometry.coordinates));
  const digest = createHash('sha256').update(JSON.stringify(union)).digest('hex');
  assert.equal(digest, digests.realtorUnion);
  assert.deepEqual(removeOverlaps(realtor), realtor);
});
test('shared edges and vertices are legal, but even thin slivers are rejected', () => {
  const a = rectangle('a', 0, 0, 1, 1);
  assert.deepEqual(findOverlaps([a, rectangle('b', 1, 0, 2, 1)]), []);
  assert.deepEqual(findOverlaps([a, rectangle('b', 1, 1, 2, 2)]), []);
  assert.deepEqual(findOverlaps([a, rectangle('b', 1 - 1e-9, 0, 2, 1)]), [['a', 'b']]);
});
test('repair assigns overlap once without making gaps, regardless of input order', () => {
  const a = rectangle('a', 0, 0, 2, 2),
    b = rectangle('b', 1, 0, 3, 2);
  const result = removeOverlaps({ features: [b, a] });
  assert.deepEqual(findOverlaps(result.features), []);
  assert.deepEqual(result.features.find((f) => f.id === 'a').geometry, a.geometry);
  assert.deepEqual(
    polygonClipping.xor(
      polygonClipping.union(a.geometry.coordinates, b.geometry.coordinates),
      polygonClipping.union(...result.features.map((f) => f.geometry.coordinates)),
    ),
    [],
  );
  const reverse = removeOverlaps({ features: [a, b] });
  assert.deepEqual(result.features, [...reverse.features].reverse());
  assert.throws(() => removeOverlaps({ features: [a, rectangle('b', 0.5, 0.5, 1, 1)] }), /erase b/);
});
