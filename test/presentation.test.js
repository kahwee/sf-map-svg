import assert from 'node:assert/strict';
import test from 'node:test';
import { neighborhoodCollections } from '../dist/data/lookup.js';
import { fullMapData } from '../dist/src/full-data.js';
import { getLayerPaths, renderMap } from '../dist/src/static.js';
import { staticMapData } from '../dist/src/static-data.js';
import {
  designHash,
  initialState,
  interactiveOptions,
  paletteName,
  palettes,
  playgroundCode,
  readState,
  setMode,
  staticData,
  staticOptions,
} from '../website/playground/model.ts';

test('static presentation rejects removed flat keys and uses grouped layer switches', () => {
  for (const options of [
    { theme: 'transit' },
    { landmarks: true },
    { colors: {} },
    { districtStyle: () => ({}) },
  ]) {
    assert.throws(() => renderMap(staticMapData, options), /Unknown static map option/);
    assert.throws(() => getLayerPaths(staticMapData, options), /Unknown static map option/);
  }
  const svg = renderMap(staticMapData, {
    layers: { districtFills: false, landmarks: true },
    appearance: { theme: 'transit', colors: { water: '#123456' } },
  }).svg;
  assert.ok(svg.includes('#123456'));
  assert.ok(!svg.includes('data-layer="district-fills"'));
  assert.ok(svg.includes('data-layer="landmarks"'));
});

test('every palette generates executable static examples for all neighborhood sources', () => {
  for (const palette of palettes)
    for (const source of ['realtor', 'sf-find', 'analysis']) {
      const state = {
        ...initialState(),
        render: 'static',
        source,
        palette: palette.id,
        theme: palette.theme,
        colors: palette.colors,
        pins: true,
        route: true,
        title: 'A "map" <&> test',
      };
      state.layers.neighborhoodLines = true;
      const sourceCode = playgroundCode(state).replace(/^import .*;\n/gm, '');
      const svg = new Function(
        'renderMap',
        'staticMapData',
        'neighborhoodCollections',
        `${sourceCode}\nreturn svg;`,
      )(renderMap, staticMapData, neighborhoodCollections);
      const expected = renderMap(staticData(fullMapData, source), staticOptions(state)).svg;
      const normalize = (value) => value.replace(/sf-map-\d+/g, 'sf-map-ID');
      assert.ok(
        normalize(svg) === normalize(expected),
        `${palette.id}/${source} copied SVG differs`,
      );
    }
});

test('share state round-trips and rejects malformed or executable settings', () => {
  const state = initialState();
  assert.deepEqual(
    readState(`#design=${encodeURIComponent(JSON.stringify({ version: 1, ...state }))}`),
    state,
  );
  for (const value of [
    null,
    [],
    { source: 'other' },
    { version: 2 },
    { colors: [] },
    { radius: 3.5 },
    { weight: 525 },
    { size: 100 },
    { layers: { highways: 'yes' } },
    { colors: { water: 'url(https://example.com)' } },
    { title: 'a'.repeat(121) },
  ])
    assert.throws(() =>
      readState(
        `#design=${encodeURIComponent(JSON.stringify(value && !Array.isArray(value) ? { version: 1, ...value } : value))}`,
      ),
    );
  assert.throws(() => readState(`#design=${encodeURIComponent(JSON.stringify(state))}`));
  assert.throws(() => readState('x'.repeat(12001)));
  const options = interactiveOptions(state);
  assert.equal(options.features.layerTransitions, state.features.layerTransitions);
  assert.equal(options.features.districtMorph, state.features.districtMorph);
});

test('mode defaults follow the view while explicit layer overrides survive share and undo snapshots', () => {
  const state = initialState();
  state.layerOverrides.districtLines = true;
  setMode(state, 'neighborhoods');
  assert.equal(state.layers.districtLines, true);
  assert.equal(state.layers.districtFills, false);
  assert.equal(state.layers.neighborhoodLines, true);
  const restored = readState(`#${designHash(state)}`);
  assert.deepEqual(restored, state);
  setMode(restored, 'basemap');
  assert.equal(restored.layers.districtLines, true);
  assert.equal(restored.layers.neighborhoodLines, false);
  assert.equal(paletteName(state), 'Original atlas');
  state.colors.water = '#123456';
  assert.equal(paletteName(state), 'Custom palette');
});
