import assert from 'node:assert/strict';
import test from 'node:test';
import data from '../dist/src/data.js';
import { getLayerPaths, renderMap } from '../dist/src/static.js';

test('structured paths use the exact renderMap projection and all three canonical district years', () => {
  for (const year of [2002, 2012, 2022]) {
    const geometry = getLayerPaths(data, { year });
    const rendered = renderMap(data, { year, idPrefix: 'election' });
    assert.equal(geometry.year, year);
    assert.equal(geometry.districts.length, 11);
    assert.deepEqual(geometry.viewBox, rendered.viewBox);
    assert.deepEqual(geometry.project([-122.42, 37.77]), rendered.project([-122.42, 37.77]));
    assert.ok(rendered.svg.includes(`d="${geometry.coast}"`));
    assert.ok(rendered.svg.includes(`d="${geometry.districts[0].path}"`));
    assert.ok(geometry.districts.every(({ path, geometry, extras }) => path === geometry + extras));
  }
});

test('district style callback runs once per row and escapes SVG attributes', () => {
  const visited = [];
  const svg = renderMap(data, {
    year: 2022,
    districtStyle: (district) => {
      visited.push(district.id);
      return {
        fill: district.id === 1 ? 'red" onload="alert(1)' : '#abc',
        stroke: '#123',
        opacity: 0.6,
      };
    },
  }).svg;
  assert.deepEqual(
    visited.sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  assert.match(svg, /fill="red&quot;/);
  assert.doesNotMatch(svg, /fill="red" onload=/);
  assert.match(svg, /stroke="#123"/);
  assert.match(svg, /fill-opacity="0.6"/);
  assert.match(svg, /stroke-opacity="0.6"/);
  assert.throws(() => renderMap(data, { districtStyle: () => ({ opacity: NaN }) }), RangeError);
  assert.throws(() => renderMap(data, { districtStyle: () => ({ invalid: true }) }), TypeError);
});
