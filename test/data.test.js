import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  catalog,
  districtMaps,
  getNeighborhood,
  neighborhoodCollections,
  neighborhoods,
  searchNeighborhoods,
} from '@kahwee/sf-map-svg/data';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';
import { geometryPath, positions } from '@kahwee/sf-map-svg/geometry';
import { renderMap } from '@kahwee/sf-map-svg/static';
import digests from './fixtures/geometry-digests.json' with { type: 'json' };

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const create = (options = {}) => renderMap(fullMapData.map, options);
test('district GeoJSON preserves all original geometry, extras, and unique districts', () => {
  for (const [year, collection] of Object.entries(districtMaps)) {
    assert.deepEqual(
      collection.features.map((f) => f.properties.district),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
    assert.equal(new Set(collection.features.map((f) => f.id)).size, 11);
    for (const [index, feature] of collection.features.entries()) {
      assert.equal(
        hash({ geometry: feature.geometry, extras: feature.properties.displayExtras }),
        digests.districts[year][index].sha256,
      );
    }
    assert.equal(
      collection.features.find((f) => f.properties.district === 6).properties.labelPoints.length,
      2,
    );
  }
  assert.equal(districtMaps[2022].features[10].properties.displayExtras.type, 'LineString');
});
test('complete source inventories stay separate and preserve SF Find geometry', () => {
  assert.deepEqual(
    Object.values(neighborhoodCollections).map((c) => c.features.length),
    [117, 41, 92],
  );
  assert.equal(catalog.neighborhoods.length, 250);
  assert.equal(
    hash(
      neighborhoodCollections['sf-find'].features.map((f) => ({
        name: f.properties.sourceName,
        geometry: f.geometry,
      })),
    ),
    digests.sfFind,
  );
  for (const [source, collection] of Object.entries(neighborhoodCollections)) {
    assert.equal(new Set(collection.features.map((f) => f.id)).size, collection.features.length);
    for (const feature of collection.features) {
      assert.ok(feature.properties.canonicalName);
      assert.ok(feature.properties.sourceName);
      assert.equal(feature.properties.definitionSource, source);
      assert.ok(Array.isArray(feature.properties.aliases));
      if (feature.properties.aliases.length) assert.ok(feature.properties.nameSources.length);
    }
  }
});
test('lookup handles aliases without conflating Mission and Outer Mission or sources', () => {
  assert.equal(getNeighborhood('The Mission', { source: 'sf-find' }).id, 'mission');
  assert.equal(getNeighborhood('Mission District', { source: 'sf-find' }).id, 'mission');
  assert.equal(getNeighborhood('outer-mission').id, 'outer-mission');
  assert.notDeepEqual(
    getNeighborhood('Inner Mission').geometry,
    getNeighborhood('Outer Mission').geometry,
  );
  assert.notDeepEqual(
    getNeighborhood('Inner Mission').geometry,
    getNeighborhood('Mission', { source: 'analysis' }).geometry,
  );
  assert.equal(getNeighborhood('soma').properties.canonicalName, 'South of Market');
  assert.equal(neighborhoods.id, 'realtor');
  assert.equal(neighborhoods.features.length, 92);
  assert.equal(getNeighborhood('Mission'), undefined);
  assert.equal(getNeighborhood('Inner Mission').properties.definitionSource, 'realtor');
  assert.equal(getNeighborhood('Outer Mission').properties.definitionSource, 'realtor');
  assert.equal(getNeighborhood('NoPa').id, 'north-panhandle');
  assert.equal(getNeighborhood('NoPa', { source: 'sf-find' }), undefined);
  assert.equal(getNeighborhood('NoPa', { source: 'realtor' }).id, 'north-panhandle');
  assert.equal(getNeighborhood(''), undefined);
  assert.equal(getNeighborhood('made-up-area'), undefined);
  assert.throws(() => getNeighborhood('Mission', { source: 'unknown' }), RangeError);
  assert.throws(() => getNeighborhood(null), TypeError);
  const results = searchNeighborhoods('mission');
  assert.ok(results.some((r) => r.id === 'outer-mission'));
  assert.equal(
    new Set(results.filter((r) => r.id === 'outer-mission').map((r) => r.source)).size,
    3,
  );
  assert.ok(searchNeighborhoods('', { source: 'analysis' }).every((r) => r.source === 'analysis'));
});
test('public helper data is immutable and cannot alter subsequent renders', () => {
  const before = create({ idPrefix: 'immutable', neighborhoodLines: true }).svg;
  assert.throws(() => {
    getNeighborhood('Inner Mission').geometry.coordinates[0][0][0][0] = 0;
  }, TypeError);
  assert.throws(() => {
    districtMaps[2022].features[0].properties.labelPoints[0][0] = 0;
  }, TypeError);
  assert.equal(create({ idPrefix: 'immutable', neighborhoodLines: true }).svg, before);
});
test('every JSON asset is exported, finite, and matches its catalog count', async () => {
  for (const dataset of catalog.datasets) {
    const { default: json } = await import(`@kahwee/sf-map-svg/data/${dataset.file}`, {
      with: { type: 'json' },
    });
    assert.equal(json.type, 'FeatureCollection');
    assert.equal(json.schemaVersion, 1);
    assert.equal(json.features.length, dataset.featureCount);
    assert.ok(
      json.sources.every((source) => source.url.startsWith('https://') && source.retrievedAt),
    );
    for (const feature of json.features) {
      assert.equal(feature.type, 'Feature');
      assert.ok(feature.bbox.every(Number.isFinite));
      for (const [lng, lat] of positions(feature.geometry)) {
        assert.ok(Number.isFinite(lng) && Math.abs(lng) <= 180);
        assert.ok(Number.isFinite(lat) && Math.abs(lat) < 90);
        assert.ok(
          lng >= feature.bbox[0] &&
            lng <= feature.bbox[2] &&
            lat >= feature.bbox[1] &&
            lat <= feature.bbox[3],
        );
      }
    }
  }
  assert.deepEqual(
    JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8')),
    catalog,
  );
});
test('exported geometry helper projects a selected neighborhood onto the map', () => {
  const map = create();
  const path = geometryPath(getNeighborhood('Inner Mission').geometry, map.project);
  assert.match(path, /^M/);
  assert.ok(!/NaN|Infinity/.test(path));
  assert.ok(path.endsWith('Z'));
});
