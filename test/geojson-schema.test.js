import assert from 'node:assert/strict';
import test from 'node:test';
import coast from '../data/coast.json' with { type: 'json' };
import realtor from '../data/neighborhoods-realtor.json' with { type: 'json' };
import { validateMapFeatureCollection } from '../scripts/lib/validate-map-geojson.mjs';

test('GeoJSON validation accepts canonical coastline and nullable source codes', () => {
  validateMapFeatureCollection(coast, 'coast', 'coast.json');
  const feature = realtor.features.find(({ properties }) => properties.sourceCode === null);
  validateMapFeatureCollection(
    { ...realtor, features: [feature] },
    'neighborhood',
    'neighborhoods-realtor.json',
  );
});

test('GeoJSON validation rejects unclosed polygon rings', () => {
  const invalid = structuredClone(coast);
  invalid.features[0].geometry.coordinates[0][0].pop();
  assert.throws(
    () => validateMapFeatureCollection(invalid, 'coast', 'broken-coast.json'),
    /must be closed by repeating its first position/,
  );
});

test('GeoJSON validation rejects coordinates outside WGS84 ranges', () => {
  const invalid = structuredClone(coast);
  invalid.features[0].geometry.coordinates[0][0][0][0] = 181;
  assert.throws(
    () => validateMapFeatureCollection(invalid, 'coast', 'broken-coast.json'),
    /must use WGS84 longitude and latitude ranges/,
  );
});
