import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { renderMap } from '../dist/src/static.js';

const coast = {
  type: 'Polygon',
  coordinates: [
    [
      [-123, 37],
      [-122, 37],
      [-122, 38],
      [-123, 38],
      [-123, 37],
    ],
  ],
};
const label = [-122.5, 37.5];
const data = (id = 1, labelPoints = [label]) => ({
  coast,
  districts: { 2022: [{ id, label, labelPoints, geometry: coast, extras: null }] },
});

test('custom district IDs cannot inject SVG attributes, label markup, or animated CSS', () => {
  const invalidIds = [
    '1" onmouseover="alert(1)',
    '</text><script>alert(1)</script><text>',
    '1;fill:red;--i:0',
    '1',
    NaN,
    Infinity,
    -Infinity,
    { toString: () => '1" onload="alert(1)' },
  ];
  const layers = [
    { districtFills: true, districtLines: false, districtLabels: false },
    { districtFills: false, districtLines: true, districtLabels: false },
    { districtFills: false, districtLines: false, districtLabels: true },
  ];
  for (const id of invalidIds)
    for (const options of layers)
      for (const animation of [false, true])
        assert.throws(
          () =>
            renderMap(data(id), {
              ...options,
              animation,
              districtStyle: () => ({ fill: '#fff' }),
            }),
          { name: 'TypeError', message: 'District IDs must be finite numbers.' },
        );
});

test('valid numeric district IDs produce well-formed SVG including animation and labels', () => {
  const errors = [];
  const svg = renderMap(data(11), { idPrefix: 'safe-district', animation: true }).svg;
  const document = new DOMParser({
    onError: (level, message) => errors.push([level, message]),
  }).parseFromString(svg, 'image/svg+xml');
  assert.deepEqual(errors, []);
  const paths = Array.from(document.getElementsByTagName('path')).filter((path) =>
    path.hasAttribute('data-district'),
  );
  assert.equal(paths.length, 2);
  for (const path of paths) {
    assert.equal(path.getAttribute('data-district'), '11');
    assert.equal(path.getAttribute('style'), '--i:11');
    assert.equal(path.hasAttribute('onmouseover'), false);
  }
  assert.equal(document.getElementsByTagName('text')[0].textContent, '11');
  assert.equal(document.getElementsByTagName('script').length, 0);
});

test('empty district labelPoints use the primary label without changing other output', () => {
  for (const animation of [false, true]) {
    const options = { idPrefix: 'fallback-label', animation };
    assert.equal(renderMap(data(1, []), options).svg, renderMap(data(1, [label]), options).svg);
  }
});
