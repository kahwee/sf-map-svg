import assert from 'node:assert/strict';
import test from 'node:test';
import polygonClipping from 'polygon-clipping';
import sourceNeighborhoods from '../data/neighborhoods-realtor.json' with { type: 'json' };
import overviewNeighborhoods from '../dist/data/guide/neighborhoods-realtor.json' with {
  type: 'json',
};
import { guideMapData, loadGuideDetailedData } from '../dist/src/guide.js';
import { findOverlaps } from '../scripts/lib/topology.js';

test('guide preset imports only the curated overview datasets', () => {
  assert.deepEqual(Object.keys(guideMapData.neighborhoods), ['realtor']);
  assert.equal(guideMapData.neighborhoods.realtor.features.length, 92);
  assert.deepEqual([...new Set(guideMapData.map.highways.map(({ route }) => route))].sort(), [
    '1',
    '101',
    '280',
  ]);
  assert.deepEqual(
    guideMapData.map.keyRoads.map(({ id }) => id),
    ['market', 'geary', 'van-ness', 'lombard', '19th-avenue', 'embarcadero'],
  );
  assert.equal(guideMapData.map.landmarks.length, 6);
  assert.equal(guideMapData.map.bartStations.length, 8);
  assert.equal(guideMapData.districts, undefined);
});

test('guide neighborhood boundaries remain shared and preserve the city footprint', () => {
  assert.deepEqual(findOverlaps(overviewNeighborhoods.features), []);
  const sourceUnion = polygonClipping.union(
    ...sourceNeighborhoods.features.map((feature) => feature.geometry.coordinates),
  );
  const overviewUnion = polygonClipping.union(
    ...overviewNeighborhoods.features.map((feature) => feature.geometry.coordinates),
  );
  const change = [
    ...polygonClipping.difference(sourceUnion, overviewUnion),
    ...polygonClipping.difference(overviewUnion, sourceUnion),
  ];
  const area = change.reduce(
    (total, polygon) =>
      total +
      polygon.reduce((polygonArea, ring) => {
        let ringArea = 0;
        for (let i = 0; i < ring.length - 1; i++)
          ringArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        return polygonArea + Math.abs(ringArea) / 2;
      }, 0),
    0,
  );
  assert.ok(area < 0.00005, `overview changed too much coverage: ${area}`);
});

test('detailed guide data loads selected geography without adding historical datasets', async () => {
  const detailed = await loadGuideDetailedData();
  assert.equal(detailed.neighborhoods.realtor.features.length, 92);
  assert.equal(detailed.districts, undefined);
  assert.deepEqual([...new Set(detailed.map.highways.map(({ route }) => route))].sort(), [
    '1',
    '101',
    '280',
  ]);
});
