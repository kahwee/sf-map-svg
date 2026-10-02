import assert from 'node:assert/strict';
import test from 'node:test';
import * as api from '../dist/src/api.js';
import { expandMapOptions, prepareConfiguration } from '../dist/src/configuration.js';

test('v2 root is server-safe and requires explicit geography', () => {
  assert.deepEqual(Object.keys(api).sort(), ['createMap', 'getLayerPaths', 'renderMap']);
  assert.equal(typeof api.createMap, 'function');
});
test('v2 options have a single home and reject ambiguous legacy spellings', () => {
  assert.deepEqual(
    expandMapOptions({ features: { motion: true }, appearance: { theme: 'transit' } }),
    { motion: true, theme: 'transit' },
  );
  for (const options of [
    null,
    [],
    { motion: true },
    { colors: {} },
    { interface: 'map' },
    { onMarkerActivate() {} },
    { features: null },
    { appearance: { motion: true } },
  ])
    assert.throws(() => expandMapOptions(options));
});
test('multi-group configuration is validated before commit and resets predictably', () => {
  const current = prepareConfiguration(
    { features: {}, layers: {}, controls: {} },
    {
      features: { motion: { duration: 80 }, northArrow: true },
      layers: { landmarks: false },
      controls: { zoom: false },
    },
  );
  const before = structuredClone(current);
  for (const patch of [
    { features: { motion: true }, controls: { zoom: 1 } },
    { features: null },
    { layers: null },
    { bogus: true },
  ]) {
    assert.throws(() => prepareConfiguration(current, patch));
    assert.deepEqual(current, before);
  }
  const partial = prepareConfiguration(current, {
    features: { northArrow: undefined },
    layers: { landmarks: undefined },
  });
  assert.equal(partial.features.northArrow, false);
  assert.deepEqual(partial.features.motion, { duration: 80 });
  assert.deepEqual(partial.layers, {});
  const reset = prepareConfiguration(partial, { features: undefined, controls: undefined });
  assert.equal(reset.features.motion, false);
  assert.deepEqual(reset.controls, {});
  reset.features.northArrow = true;
  assert.equal(current.features.northArrow, true);
  assert.deepEqual(current, before);
});

test('misplaced interactive options explain their supported replacement', () => {
  for (const [input, message] of [
    [{ theme: 'districts' }, 'Use appearance.theme'],
    [{ colors: {} }, 'Use appearance.colors'],
    [{ motion: true }, 'Use features.motion'],
    [{ onMarkerActivate() {} }, "map.on('markerchange', listener)"],
    [{ onOverlayActivate() {} }, "map.on('overlayactivate', listener)"],
    [{ interface: 'map' }, 'interface is internal'],
  ]) {
    assert.throws(
      () => expandMapOptions(input),
      (error) => error instanceof TypeError && error.message.includes(message),
    );
  }
});

test('appearance token patches merge, reset, and preserve styling callbacks', () => {
  const districtStyle = () => ({ fill: '#abc' });
  const current = prepareConfiguration(
    { features: {}, layers: {}, controls: {} },
    {
      appearance: {
        colors: { water: '#111111', land: '#eeeeee' },
        labelStyle: { fontFamily: 'Georgia' },
        districtStyle,
      },
    },
  );
  const next = prepareConfiguration(current, {
    appearance: { colors: { water: '#222222' }, labelStyle: { fontWeight: 700 } },
  });
  assert.deepEqual(next.appearance.colors, { water: '#222222', land: '#eeeeee' });
  assert.deepEqual(next.appearance.labelStyle, { fontFamily: 'Georgia', fontWeight: 700 });
  assert.equal(next.appearance.districtStyle, districtStyle);
  const removed = prepareConfiguration(current, { appearance: { colors: { water: undefined } } });
  assert.deepEqual(removed.appearance.colors, { land: '#eeeeee' });
  assert.deepEqual(expandMapOptions({ appearance: { colors: { water: undefined } } }), {
    colors: {},
  });
  next.appearance.colors.land = '#aaaaaa';
  assert.equal(current.appearance.colors.land, '#eeeeee');
  assert.deepEqual(prepareConfiguration(current, { appearance: undefined }).appearance, {});
  for (const patch of [
    { appearance: { labelSize: { min: 20, max: 12 } } },
    { appearance: { markerRadius: 30 } },
    { appearance: { theme: 'oops' } },
    { appearance: { labelStyle: { fontWeight: '700' } } },
    { appearance: { colors: { ocean: 'red' } } },
    { mode: 'oops' },
    { year: 2024 },
    { source: 'oops' },
    { labels: 1 },
  ])
    assert.throws(() => prepareConfiguration(current, patch));
});
