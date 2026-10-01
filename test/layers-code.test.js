import assert from 'node:assert/strict';
import test from 'node:test';
import { neighborhoodCollections } from '../dist/data/index.js';
import { renderMap } from '../dist/src/static.js';
import { staticMapData } from '../dist/src/static-data.js';
import { interactiveCode, staticCode } from '../website/layers-code.js';

const state = (patch = {}) => ({
  mode: 'neighborhoods',
  source: 'realtor',
  year: 2022,
  labels: true,
  layers: {
    districtFills: false,
    districtLines: false,
    districtLabels: false,
    neighborhoodLines: true,
    neighborhoodLabels: true,
    landmarks: true,
    highways: true,
    keyRoads: true,
    roadLabels: false,
    bartStations: true,
  },
  features: { layerTransitions: true, districtMorph: true, motion: true },
  ...patch,
});
const withoutImports = (code) => code.replace(/^import .*;\n/gm, '');

// Execute the copyable snippet itself, rather than testing its formatting.
function copiedOptions(input) {
  let options;
  const createMap = (_data, supplied) => {
    options = supplied;
    return { element: {} };
  };
  new Function('createMap', 'fullMapData', 'document', withoutImports(interactiveCode(input)))(
    createMap,
    {},
    { querySelector: () => ({ append() {} }) },
  );
  return options;
}

test('copied interactive examples preserve mode, layers and motion settings', () => {
  for (const mode of ['basemap', 'neighborhoods', 'districts']) {
    for (const source of ['realtor', 'sf-find', 'analysis']) {
      for (const year of [2002, 2012, 2022]) {
        const input = state({ mode, source, year, labels: false });
        const options = copiedOptions(input);
        assert.equal(options.mode, mode);
        assert.equal(options.source ?? 'realtor', source);
        assert.equal(options.year ?? 2022, year);
        assert.equal(options.labels, false);
        assert.deepEqual(options.layers, input.layers);
        assert.deepEqual(options.features, {
          layerTransitions: { duration: 480 },
          districtMorph: { duration: 1300 },
          motion: { duration: 600 },
        });
        assert.equal(options.appearance.theme, 'districts');
      }
    }
  }
  const input = state();
  for (const key of Object.keys(input.layers)) input.layers[key] = !input.layers[key];
  for (const key of Object.keys(input.features)) input.features[key] = false;
  const options = copiedOptions(input);
  assert.deepEqual(options.layers, input.layers);
  assert.equal(options.features, undefined);
});

test('copied static examples render the selected source and layers with the public API', () => {
  for (const source of ['realtor', 'sf-find', 'analysis']) {
    const input = state({ source });
    const svg = new Function(
      'renderMap',
      'staticMapData',
      'neighborhoodCollections',
      `${withoutImports(staticCode(input))}\nreturn svg;`,
    )(renderMap, staticMapData, neighborhoodCollections);
    const collection = neighborhoodCollections[source];
    assert.equal((svg.match(/data-neighborhood=/g) ?? []).length, collection.features.length);
    assert.match(svg, /<g data-layer="bart-stations"/);
    assert.doesNotMatch(svg, /<g data-layer="district-fills"/);
    assert.doesNotMatch(svg, /<g data-layer="road-labels"/);
    assert.ok(!/NaN|Infinity/.test(svg));
  }
});

test('released studio snippets omit unsupported feature and animation options', () => {
  const input = state({
    animation: false,
    supportedFeatures: { layerTransitions: false, districtMorph: false },
  });
  const options = copiedOptions(input);
  assert.deepEqual(options.features, { motion: { duration: 600 } });
  assert.doesNotMatch(staticCode(input), /animation:/);
});
