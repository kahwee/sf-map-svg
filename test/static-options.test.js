import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { fullMapData } from '../dist/src/full-data.js';
import { resolveMapColors } from '../dist/src/map-core.js';
import { getLayerPaths, renderMap } from '../dist/src/static.js';

const description = (svg) =>
  new DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagName('desc')[0].textContent;

test('static entry points reject typo keys and invalid flat values before styling callbacks', () => {
  const switches = [
    'districtFills',
    'districtLines',
    'districtLabels',
    'neighborhoodLines',
    'landmarks',
    'bartStations',
    'highways',
    'keyRoads',
    'roadLabels',
    'labels',
  ];
  const invalid = [
    { landmark: true },
    { neighborhoodLabels: true },
    { theme: 'unknown' },
    { colors: null },
    { colors: { ocean: 'red' } },
    { colors: { water: 42 } },
    { title: 123 },
    { idPrefix: 123 },
    { animation: { duration: -1 } },
    { markers: null },
    { overlays: null },
    ...switches.flatMap((key) => ['false', 1, null].map((value) => ({ [key]: value }))),
  ];
  let calls = 0;
  for (const operation of [renderMap, getLayerPaths])
    for (const options of invalid)
      assert.throws(() =>
        operation(fullMapData, {
          ...options,
          districtStyle: () => {
            calls++;
            return {};
          },
        }),
      );
  assert.equal(calls, 0);
  for (const operation of [renderMap, getLayerPaths])
    assert.throws(() => operation(fullMapData, { districtStyle: 'red' }), TypeError);
});

test('undefined flat color tokens retain theme defaults and grouped precedence', () => {
  for (const theme of ['districts', 'transit']) {
    const defaults = resolveMapColors(theme);
    assert.deepEqual(resolveMapColors(theme, { water: undefined }), defaults);
    const base = { idPrefix: 'color-defaults', theme };
    const expected = renderMap(fullMapData, base).svg;
    for (const options of [
      { colors: { water: undefined } },
      { appearance: { colors: { water: undefined } } },
      { colors: undefined, layers: { landmarks: undefined }, labels: undefined },
    ])
      assert.equal(renderMap(fullMapData, { ...base, ...options }).svg, expected);
    const svg = renderMap(fullMapData, {
      ...base,
      colors: { water: '#123456', land: undefined },
      appearance: { colors: { water: '#abcdef' } },
    }).svg;
    assert.match(svg, /fill="#abcdef"/);
    assert.doesNotMatch(svg, /fill="undefined"|fill="#123456"/);
    assert.equal(
      renderMap(fullMapData, {
        ...base,
        colors: { water: '#123456' },
        appearance: { colors: undefined },
      }).svg,
      renderMap(fullMapData, { ...base, colors: { water: '#123456' } }).svg,
    );
  }
});

test('source-aware SVG descriptions identify explicit and default neighborhood definitions', () => {
  const names = {
    realtor: 'SFAR realtor neighborhood areas, defined in August 2010',
    'sf-find': 'SF Find neighborhood areas',
    analysis: 'DataSF analysis neighborhood areas',
  };
  for (const [source, name] of Object.entries(names)) {
    const text = description(
      renderMap(fullMapData, { source, layers: { neighborhoodLines: true } }).svg,
    );
    assert.ok(text.includes(name));
    for (const other of Object.values(names)) if (other !== name) assert.ok(!text.includes(other));
    const fallback = {
      ...fullMapData,
      neighborhoods: { [source]: fullMapData.neighborhoods[source] },
    };
    assert.ok(description(renderMap(fallback, { neighborhoodLines: true }).svg).includes(name));
  }
  const compact = description(renderMap(fullMapData.map, { neighborhoodLines: true }).svg);
  assert.ok(compact.includes('the supplied neighborhood areas'));
  assert.ok(!compact.includes('SFAR'));
});

test('SVG descriptions follow supplied data, actual counts, and enabled layers', () => {
  const options = { neighborhoodLines: true, landmarks: true, bartStations: true, keyRoads: true };
  const coastOnly = { coast: fullMapData.map.coast };
  const empty = description(renderMap(coastOnly, options).svg);
  assert.equal(empty, 'San Francisco map. See SOURCES.md for geographic sources.');
  const subset = {
    coast: fullMapData.map.coast,
    landmarks: fullMapData.map.landmarks.slice(0, 1),
    bartStations: fullMapData.map.bartStations.slice(0, 1),
  };
  const text = description(renderMap(subset, options).svg);
  assert.ok(text.includes('Park and landmark features: 1.'));
  assert.ok(text.includes('BART stations: 1.'));
  assert.ok(!text.includes('district boundaries'));
  assert.ok(!text.includes('Dashed lines'));
  assert.ok(!text.includes('road corridors'));
  const disabled = description(
    renderMap(fullMapData, {
      districtFills: false,
      districtLines: false,
      districtLabels: false,
      layers: { landmarks: false, bartStations: false },
    }).svg,
  );
  assert.equal(disabled, empty);
  assert.ok(
    !description(
      renderMap(fullMapData, { districtFills: false, districtLines: false, labels: false }).svg,
    ).includes('district boundaries'),
  );
});
