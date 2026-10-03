import assert from 'node:assert/strict';
import test from 'node:test';
import { neighborhoodCollections } from '../dist/data/lookup.js';
import { fullMapData } from '../dist/src/full-data.js';
import { createGuideSVG } from '../dist/src/guide-static.js';
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
} from '../website/playground-model.ts';

const capabilities = {
  animation: true,
  staticPresentation: true,
  runtimeAppearance: true,
  layerTransitions: true,
  districtMorph: true,
};

test('grouped static presentation matches flat rendering and has explicit precedence', () => {
  const flat = {
    idPrefix: 'same',
    theme: 'transit',
    colors: { water: '#123456' },
    districtFills: false,
    landmarks: true,
    bartStations: true,
  };
  const grouped = {
    idPrefix: 'same',
    layers: { districtFills: false, landmarks: true, bartStations: true },
    appearance: { theme: 'transit', colors: { water: '#123456' } },
  };
  assert.equal(renderMap(staticMapData, grouped).svg, renderMap(staticMapData, flat).svg);
  assert.equal(createGuideSVG(grouped).svg, createGuideSVG(flat).svg);
  const { project: groupedProject, ...groupedPaths } = getLayerPaths(staticMapData, grouped);
  const { project: flatProject, ...flatPaths } = getLayerPaths(staticMapData, flat);
  assert.deepEqual(groupedPaths, flatPaths);
  assert.deepEqual(groupedProject([-122.42, 37.76]), flatProject([-122.42, 37.76]));
  const mixed = renderMap(staticMapData, {
    ...flat,
    districtFills: true,
    layers: { districtFills: false },
  }).svg;
  assert.doesNotMatch(mixed, /data-layer="district-fills"/);
  for (const options of [
    { layers: { neighborhoodLabels: true } },
    { layers: { bartStations: 1 } },
    { appearance: { font: 'Georgia' } },
    { appearance: { colors: { ocean: 'red' } } },
  ])
    assert.throws(() => renderMap(staticMapData, options));
  assert.match(
    renderMap(staticMapData, {
      title: '<hello & "world">',
      markers: Object.freeze([{ id: 'one', lng: -122.4, lat: 37.76 }]),
    }).svg,
    /&lt;hello &amp; &quot;world&quot;&gt;/,
  );
});

test('every palette generates executable static examples for both API generations and all neighborhood sources', () => {
  for (const palette of palettes)
    for (const source of ['realtor', 'sf-find', 'analysis'])
      for (const grouped of [true, false]) {
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
        const support = { ...capabilities, staticPresentation: grouped };
        const sourceCode = playgroundCode(state, support).replace(/^import .*;\n/gm, '');
        const svg = new Function(
          'renderMap',
          'staticMapData',
          'neighborhoodCollections',
          `${sourceCode}\nreturn svg;`,
        )(renderMap, staticMapData, neighborhoodCollections);
        const expected = renderMap(
          staticData(fullMapData, source),
          staticOptions(state, support),
        ).svg;
        const normalize = (value) => value.replace(/sf-map-\d+/g, 'sf-map-ID');
        assert.ok(
          normalize(svg) === normalize(expected),
          `${palette.id}/${source}/grouped=${grouped} copied SVG differs`,
        );
      }
});

test('share state round-trips and rejects malformed or executable settings', () => {
  const state = initialState();
  assert.deepEqual(readState(`#design=${encodeURIComponent(JSON.stringify(state))}`), state);
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
    assert.throws(() => readState(`#design=${encodeURIComponent(JSON.stringify(value))}`));
  assert.throws(() => readState('x'.repeat(12001)));
  const options = interactiveOptions(state, { layerTransitions: false, districtMorph: false });
  assert.equal(options.features.layerTransitions, undefined);
  assert.equal(options.features.districtMorph, undefined);
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
