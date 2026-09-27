import assert from 'node:assert/strict';
import test from 'node:test';
import { guideMapData } from '../dist/src/guide-data.js';
import { loadGuideDetailedData } from '../dist/src/guide-detailed.js';
import { createGuideMap } from '../dist/src/guide-map.js';
import { createGuideSVG } from '../dist/src/guide-static.js';

test('public construction rejects malformed and conflicting-value options before touching the browser', () => {
  for (const options of [
    null,
    [],
    { motion: { duraton: 100 } },
    { attribution: 'tiny' },
    { labels: 'false' },
    { selectableNeighborhoods: 1 },
    { onMarkerActivate: true },
    { labelStyle: { fontFamily: 2 } },
    { legend: { items: [null] } },
    { controls: null },
    { fitPadding: null },
    { colors: { ocean: 'red' } },
  ])
    assert.throws(
      () => createGuideMap(options),
      (error) => !/browser document/.test(error.message),
    );
});
test('static and interactive overlay contract excludes point geometry and ambiguous identifiers', () => {
  const geometry = {
    type: 'LineString',
    coordinates: [
      [-122.43, 37.75],
      [-122.4, 37.79],
    ],
  };
  assert.match(
    createGuideSVG({ overlays: [{ id: 'route', geometry }] }).svg,
    /data-overlay-id="route"/,
  );
  for (const overlays of [
    [{ id: 'point', geometry: { type: 'Point', coordinates: [-122.4, 37.7] } }],
    [
      { id: 'route', geometry },
      { id: 'route', geometry },
    ],
    [undefined],
    [{ id: 'empty', geometry: { type: 'LineString', coordinates: [] } }],
    [{ id: 'sparse', geometry: { type: 'LineString', coordinates: new Array(2) } }],
    [{ id: 'ring', geometry: { type: 'Polygon', coordinates: [[]] } }],
    [{ id: 'route', geometry, visible: 'no' }],
  ])
    assert.throws(() => createGuideSVG({ overlays }));
  for (const markers of [
    [
      { id: 'same', lng: -122.4, lat: 37.7 },
      { id: 'same', lng: -122.4, lat: 37.7 },
    ],
    new Array(2),
    [{ id: 'x', lng: -122.4, lat: 37.7, selected: 'yes' }],
  ])
    assert.throws(() => createGuideSVG({ markers }));
});
test('shared overview and detailed geography cannot poison future consumers', async () => {
  for (const data of [guideMapData, await loadGuideDetailedData()]) {
    assert.ok(Object.isFrozen(data));
    const feature = data.neighborhoods.realtor.features[0];
    const name = feature.properties.canonicalName;
    assert.throws(() => {
      feature.properties.canonicalName = 'Changed';
    }, TypeError);
    assert.equal(feature.properties.canonicalName, name);
  }
});
