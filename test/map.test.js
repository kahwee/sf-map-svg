import test from 'node:test';
import assert from 'node:assert/strict';
import { createSFMap, renderSFMap, districtYears, neighborhoodNames } from '../src/index.js';

test('each historical map has eleven districts and finite standalone SVG geometry', () => {
  for (const year of districtYears) {
    const svg = renderSFMap({ year });
    assert.equal((svg.match(/data-district=/g) ?? []).length, 22);
    assert.ok(!/NaN|Infinity|<image|<script|https?:\/\/(?!www.w3.org)/.test(svg));
    assert.ok(!svg.includes('data-layer="neighborhood-lines"'));
  }
});
test('neighborhood layer is optional and contains every named area', () => {
  assert.equal(neighborhoodNames.length, 117);
  const svg = renderSFMap({ neighborhoodLines: true, districtLines: false });
  assert.equal((svg.match(/data-neighborhood=/g) ?? []).length, 117);
  assert.ok(!svg.includes('data-layer="district-lines"'));
});
test('projection places SF points inside map and matches marker coordinates', () => {
  const map = createSFMap({ markers: [{ id: 'park', lng: -122.4269, lat: 37.7596 }] });
  const [x, y] = map.project([-122.4269, 37.7596]);
  assert.ok(x > 28 && x < 772 && y > 28 && y < 772);
  assert.ok(map.svg.includes(`cx="${Number(x.toFixed(2))}" cy="${Number(y.toFixed(2))}"`));
  assert.ok(map.project([-122.4269, 37.8])[1] < y);
  assert.ok(map.project([-122.4, 37.7596])[0] > x);
});
test('escapes labels and rejects invalid projections and dimensions', () => {
  assert.ok(renderSFMap({ title: '<script>&"' }).includes('&lt;script&gt;&amp;&quot;'));
  assert.throws(() => renderSFMap({ year: 2020 }), RangeError);
  assert.throws(() => renderSFMap({ width: 0 }), RangeError);
  assert.throws(() => renderSFMap({ idPrefix: 'bad"' }), TypeError);
  assert.throws(() => createSFMap().project([0, 90]), RangeError);
});
test('explicit ids make output deterministic', () => {
  assert.equal(renderSFMap({ idPrefix: 'example' }), renderSFMap({ idPrefix: 'example' }));
});

import { DOMParser } from '@xmldom/xmldom';

test('every layer combination produces valid XML with resolvable clip paths', () => {
  for (const year of districtYears) {
    for (const neighborhoodLines of [false, true]) {
      const errors = [];
      const svg = renderSFMap({
        year,
        neighborhoodLines,
        highways: true,
        title: 'Park\u0000 & <city>',
        markers: [{ id: 'a"<&', lng: -122.4, lat: 37.77, label: '<hello> & friends' }],
      });
      const document = new DOMParser({
        onError: (level, message) => errors.push({ level, message }),
      }).parseFromString(svg, 'image/svg+xml');
      assert.deepEqual(errors, []);
      assert.equal(document.documentElement.namespaceURI, 'http://www.w3.org/2000/svg');
      for (const element of Array.from(document.getElementsByTagName('*'))) {
        const clip = element.getAttribute('clip-path');
        if (clip) assert.ok(document.getElementById(clip.slice(5, -1)));
      }
      assert.equal(document.getElementsByTagName('script').length, 0);
    }
  }
});
