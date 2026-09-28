import assert from 'node:assert/strict';
import test from 'node:test';
import { fullMapData } from '../dist/src/full-data.js';
import { renderMap } from '../dist/src/static.js';

const districtYears = [2002, 2012, 2022];
const neighborhoodNames = fullMapData.map.neighborhoods.map(({ name }) => name);
const create = (options = {}) => renderMap(fullMapData.map, options);
const render = (options = {}) => create(options).svg;

test('each historical map has eleven districts and finite standalone SVG geometry', () => {
  for (const year of districtYears) {
    const svg = render({ year });
    assert.equal((svg.match(/data-district=/g) ?? []).length, 22);
    assert.ok(!/NaN|Infinity|<image|<script|https?:\/\/(?!www.w3.org)/.test(svg));
    assert.ok(!svg.includes('data-layer="neighborhood-lines"'));
  }
});
test('neighborhood layer is optional and contains every named area', () => {
  assert.equal(neighborhoodNames.length, 92);
  assert.ok(neighborhoodNames.includes('Inner Mission'));
  assert.ok(neighborhoodNames.includes('Outer Mission'));
  assert.ok(neighborhoodNames.includes('North Panhandle'));
  const svg = render({ neighborhoodLines: true, districtLines: false });
  assert.equal((svg.match(/data-neighborhood=/g) ?? []).length, 92);
  assert.ok(!svg.includes('data-layer="district-lines"'));
  assert.ok(svg.includes('SFAR realtor neighborhood areas, defined in August 2010'));
  assert.ok(!svg.includes('SF Find neighborhood areas'));
});
test('projection places SF points inside map and matches marker coordinates', () => {
  const map = create({ markers: [{ id: 'park', lng: -122.4269, lat: 37.7596 }] });
  const [x, y] = map.project([-122.4269, 37.7596]);
  assert.ok(x > 28 && x < 772 && y > 28 && y < 772);
  assert.ok(map.svg.includes(`cx="${Number(x.toFixed(2))}" cy="${Number(y.toFixed(2))}"`));
  assert.ok(map.project([-122.4269, 37.8])[1] < y);
  assert.ok(map.project([-122.4, 37.7596])[0] > x);
});
test('escapes labels and rejects invalid projections and dimensions', () => {
  assert.ok(render({ title: '<script>&"' }).includes('&lt;script&gt;&amp;&quot;'));
  assert.throws(() => render({ year: 2020 }), RangeError);
  assert.throws(() => render({ width: 0 }), RangeError);
  assert.throws(() => render({ idPrefix: 'bad"' }), TypeError);
  assert.throws(() => create().project([0, 90]), RangeError);
});
test('explicit ids make output deterministic', () => {
  assert.equal(render({ idPrefix: 'example' }), render({ idPrefix: 'example' }));
});

test('data-injected renderer needs no bundled geographic collection', () => {
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
  const result = renderMap(
    { coast },
    { districtFills: false, districtLines: false, districtLabels: false },
  );
  assert.match(result.svg, /data-layer="coast"/);
  assert.doesNotMatch(result.svg, /data-layer="district-fills"/);
});

test('map overlays reject invalid numeric SVG attributes', () => {
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
  const line = {
    type: 'LineString',
    coordinates: [
      [-123, 37],
      [-122, 38],
    ],
  };
  const render = (overlay) =>
    renderMap(
      { coast },
      { districtFills: false, districtLines: false, districtLabels: false, overlays: [overlay] },
    );
  assert.throws(
    () => render({ id: 'bad-width', geometry: line, strokeWidth: '1" onload="x' }),
    /strokeWidth/,
  );
  assert.throws(() => render({ id: 'bad-opacity', geometry: line, fillOpacity: 2 }), /fillOpacity/);
});

import { DOMParser } from '@xmldom/xmldom';

test('combined layers produce valid XML with resolvable clip paths for every district year', () => {
  for (const year of districtYears) {
    for (const neighborhoodLines of [false, true]) {
      const errors = [];
      const svg = render({
        year,
        neighborhoodLines,
        highways: true,
        landmarks: true,
        bartStations: true,
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

test('landmarks and BART are independent optional geographic overlays', () => {
  const baseline = render();
  assert.ok(!baseline.includes('data-layer="landmarks"'));
  assert.ok(!baseline.includes('data-layer="bart-stations"'));
  const parks = render({ landmarks: true });
  assert.equal((parks.match(/data-landmark=/g) ?? []).length, 6);
  assert.ok(parks.includes('Golden Gate Park'));
  const document = new DOMParser().parseFromString(parks, 'image/svg+xml');
  const parkPaths = Array.from(document.getElementsByTagName('path')).filter((p) =>
    p.hasAttribute('data-landmark'),
  );
  assert.equal(parkPaths.length, 6);
  for (const park of parkPaths) {
    assert.match(park.getAttribute('d'), /^M/);
    assert.ok(!/NaN|Infinity/.test(park.getAttribute('d')));
  }
  assert.ok(!parks.includes('data-layer="bart-stations"'));
  const map = create({ bartStations: true, colors: { bart: '#123456' } });
  assert.equal((map.svg.match(/data-bart-station=/g) ?? []).length, 8);
  assert.ok(!map.svg.includes('data-layer="landmarks"'));
  assert.ok(!map.svg.includes('Daly City'));
  const [x, y] = map
    .project([-122.3969009943399, 37.79285391372556])
    .map((v) => Number(v.toFixed(2)));
  assert.ok(map.svg.includes(`data-bart-station="embarcadero" transform="translate(${x},${y})"`));
  assert.ok(map.svg.includes('stroke="#123456"'));
});

test('rejects overflowing and out-of-range longitude before writing SVG coordinates', () => {
  const map = create();
  for (const lng of [1e308, -1e308, 181, -181, Infinity, NaN]) {
    assert.throws(() => map.project([lng, 37.77]), RangeError);
    assert.throws(() => render({ markers: [{ id: 'bad', lng, lat: 37.77 }] }), RangeError);
  }
});

test('rejects invalid marker coordinates before running renderer callbacks', () => {
  let styleCalls = 0;
  assert.throws(
    () =>
      render({
        markers: [{ id: 'bad', lng: -122.4, lat: 90 }],
        districtStyle: () => {
          styleCalls++;
          return {};
        },
      }),
    /Marker coordinates/,
  );
  assert.equal(styleCalls, 0);
  assert.throws(
    () => render({ markers: [{ id: 'bad', lng: '-122.4', lat: 37.77 }] }),
    /Marker coordinates/,
  );
});

test('optional layers work independently and preserve unique district IDs', () => {
  const options = {
    neighborhoodLines: 'neighborhood-lines',
    highways: 'highways',
    landmarks: 'landmarks',
    bartStations: 'bart-stations',
  };
  for (const [option, layer] of Object.entries(options)) {
    const svg = render({ [option]: true });
    assert.ok(svg.includes(`data-layer="${layer}"`));
    for (const [otherOption, otherLayer] of Object.entries(options)) {
      if (otherOption !== option) assert.ok(!svg.includes(`data-layer="${otherLayer}"`));
    }
  }
  for (const year of districtYears) {
    const document = new DOMParser().parseFromString(render({ year }), 'image/svg+xml');
    for (const layer of ['district-fills', 'district-lines']) {
      const group = Array.from(document.getElementsByTagName('g')).find(
        (g) => g.getAttribute('data-layer') === layer,
      );
      assert.deepEqual(
        Array.from(group.getElementsByTagName('path'), (p) =>
          Number(p.getAttribute('data-district')),
        ),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      );
    }
  }
});

test('transit custom land color cannot inject SVG attributes', () => {
  const color = 'red" onpointerover="alert(1)';
  const document = new DOMParser().parseFromString(
    render({ theme: 'transit', colors: { land: color } }),
    'image/svg+xml',
  );
  const fills = Array.from(document.getElementsByTagName('path')).filter(
    (path) => path.parentNode.getAttribute('data-layer') === 'district-fills',
  );
  assert.equal(fills.length, 11);
  for (const path of fills) {
    assert.equal(path.getAttribute('fill'), color);
    assert.equal(path.hasAttribute('onpointerover'), false);
  }
});

test('key roads are an optional layer independent of highways', () => {
  assert.ok(!render().includes('data-layer="key-roads"'));
  const svg = render({ keyRoads: true, colors: { road: '#123456' } });
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const roads = Array.from(document.getElementsByTagName('path')).filter((p) =>
    p.hasAttribute('data-key-road'),
  );
  assert.equal(roads.length, 6);
  for (const road of roads) {
    assert.equal(road.getAttribute('stroke'), '#123456');
    assert.match(road.getAttribute('d'), /^M/);
    assert.ok(!/NaN|Infinity/.test(road.getAttribute('d')));
  }
  assert.ok(svg.includes('Market St'));
  assert.ok(svg.includes('The Embarcadero'));
  assert.ok(!svg.includes('data-layer="highways"'));
  const geometryWithoutLabels = render({ keyRoads: true, roadLabels: false });
  assert.ok(geometryWithoutLabels.includes('data-layer="key-roads"'));
  assert.ok(!geometryWithoutLabels.includes('data-layer="key-road-labels"'));
  const labelsWithoutGeometry = render({ keyRoads: false, roadLabels: true });
  assert.ok(!labelsWithoutGeometry.includes('data-layer="key-roads"'));
  assert.ok(labelsWithoutGeometry.includes('data-layer="key-road-labels"'));
});

test('custom road hierarchy cannot inject SVG attributes', () => {
  const svg = renderMap(
    {
      coast: {
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
      },
      keyRoads: [
        {
          id: 'road',
          name: 'Road',
          level: 'primary" onload="alert(1)',
          sourceNames: [],
          label: [-122.5, 37.5],
          segmentIds: [],
          geometry: {
            type: 'LineString',
            coordinates: [
              [-123, 37],
              [-122, 38],
            ],
          },
        },
      ],
    },
    { districtFills: false, districtLines: false, keyRoads: true, roadLabels: false },
  ).svg;
  assert.match(svg, /data-key-road-level="primary"/);
  assert.doesNotMatch(svg, /onload=/);
});

test('master label switch hides text without removing map symbols or accessible titles', () => {
  const document = new DOMParser().parseFromString(
    render({ labels: false, landmarks: true, bartStations: true, keyRoads: true }),
    'image/svg+xml',
  );
  assert.equal(document.getElementsByTagName('text').length, 0);
  assert.ok(document.getElementsByTagName('title').length > 8);
  assert.ok(document.getElementsByTagName('circle').length >= 8);
  const numbered = new DOMParser().parseFromString(render(), 'image/svg+xml');
  for (const text of Array.from(numbered.getElementsByTagName('text')))
    assert.match(text.textContent, /^(?:[1-9]|10|11)$/);
});
