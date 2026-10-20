import assert from 'node:assert/strict';
import test from 'node:test';
import { geometryBounds, geometryContainsPoint } from '../dist/src/geometry.js';

const ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
const hole = [
  [2, 2],
  [8, 2],
  [8, 8],
  [2, 8],
];
const polygon = { type: 'Polygon', coordinates: [ring, hole] };

test('polygon queries distinguish interior, holes, edges, and vertices', () => {
  for (const point of [
    [1, 1],
    [0, 0],
    [0, 5],
    [2, 5],
    [8, 8],
  ])
    assert.equal(geometryContainsPoint(polygon, point), true, String(point));
  for (const point of [
    [5, 5],
    [-1, 5],
    [11, 10],
  ])
    assert.equal(geometryContainsPoint(polygon, point), false, String(point));
  assert.equal(
    geometryContainsPoint({ type: 'Polygon', coordinates: [ring.toReversed()] }, [5, 5]),
    true,
  );
  assert.equal(
    geometryContainsPoint({ type: 'Polygon', coordinates: [ring.slice(0, -1)] }, [5, 5]),
    true,
  );
});

test('islands and nested collections preserve polygon semantics', () => {
  const island = [
    [
      [-5, -5],
      [-3, -5],
      [-3, -3],
      [-5, -3],
    ],
  ];
  const geometry = {
    type: 'GeometryCollection',
    geometries: [
      { type: 'Point', coordinates: [20, 20] },
      {
        type: 'GeometryCollection',
        geometries: [{ type: 'MultiPolygon', coordinates: [polygon.coordinates, island] }],
      },
    ],
  };
  assert.deepEqual(geometryBounds(geometry), [-5, -5, 20, 20]);
  assert.equal(geometryContainsPoint(geometry, [-4, -4]), true);
  assert.equal(geometryContainsPoint(geometry, [5, 5]), false);
  assert.equal(geometryContainsPoint(geometry, [20, 20]), false);
});

test('empty geometry has no bounds or polygon hit; altitude is ignored', () => {
  for (const geometry of [
    null,
    undefined,
    { type: 'Polygon', coordinates: [] },
    { type: 'GeometryCollection', geometries: [] },
  ]) {
    assert.equal(geometryBounds(geometry), null);
    assert.equal(geometryContainsPoint(geometry, [0, 0]), false);
  }
  assert.deepEqual(
    geometryBounds({ type: 'Point', coordinates: [-122, 37, 100] }),
    [-122, 37, -122, 37],
  );
  assert.equal(geometryContainsPoint({ type: 'Polygon', coordinates: [[[1, 1]]] }, [1, 1]), false);
});

test('invalid coordinates fail even in unvisited collection members', () => {
  for (const point of [[NaN, 0], [0, Infinity], [181, 0], [0, -91], new Array(2)]) {
    assert.throws(() => geometryContainsPoint(polygon, point), RangeError);
    assert.throws(() => geometryBounds({ type: 'Point', coordinates: point }), RangeError);
    assert.throws(
      () =>
        geometryContainsPoint(
          {
            type: 'GeometryCollection',
            geometries: [polygon, { type: 'Point', coordinates: point }],
          },
          [1, 1],
        ),
      RangeError,
    );
  }
});
