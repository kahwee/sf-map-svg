import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { guideMapData } from '../dist/src/guide-data.js';
import { createGuideSVG } from '../dist/src/guide-static.js';
import { renderMap } from '../dist/src/static.js';
import { estimateLabelWidth } from '../dist/src/static-labels.js';

function labels(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('text')).filter((node) =>
    node.hasAttribute('data-label-kind'),
  );
}
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

for (const width of [800, 390]) {
  test(`guide labels avoid one another and map pins at ${width}px without a DOM`, () => {
    const markers = [{ id: 'mission', lng: -122.4194, lat: 37.76, radius: 9 }];
    const result = createGuideSVG({ labelLayout: { width }, markers });
    const texts = labels(result.svg);
    assert.ok(texts.length > 5);
    assert.ok(texts.some((node) => node.textContent === 'Golden Gate Park'));
    assert.equal(
      texts.some((node) => node.getAttribute('data-label-kind') === 'bart'),
      false,
    );
    assert.ok(texts.some((node) => node.getAttribute('data-label-kind') === 'neighborhood'));
    const unit = 800 / width;
    const boxes = texts.map((node) => {
      const size = Number(node.getAttribute('font-size')) / unit;
      const x =
        Number(node.getAttribute('x')) / unit - estimateLabelWidth(node.textContent, size) / 2;
      const y = Number(node.getAttribute('y')) / unit - size;
      return [
        x - 3,
        y - 3,
        x + estimateLabelWidth(node.textContent, size) + 3,
        y + size * 1.25 + 3,
      ];
    });
    const obstacles = [
      ...guideMapData.map.bartStations.map((station) => {
        const [x, y] = result.project(station.coordinates).map((value) => value / unit);
        return [x - 6, y - 6, x + 6, y + 6];
      }),
      ...markers.map((marker) => {
        const [x, y] = result.project([marker.lng, marker.lat]).map((value) => value / unit);
        return [x - 12, y - 12, x + 12, y + 12];
      }),
    ];
    boxes.forEach((box, index) => {
      assert.ok(
        box[0] >= 1.99 && box[1] >= 1.99 && box[2] <= width - 1.99 && box[3] <= width - 1.99,
      );
      for (const other of [...boxes.slice(index + 1), ...obstacles])
        assert.equal(overlaps(box, other), false);
    });
  });
}

test('overview priorities respond to width and layer switches', () => {
  const names = (options) => labels(createGuideSVG(options).svg).map((node) => node.textContent);
  assert.ok(names({ labelLayout: { width: 800 }, neighborhoodLabels: false }).includes('Presidio'));
  assert.equal(
    names({ labelLayout: { width: 390 }, neighborhoodLabels: false }).includes('Presidio'),
    false,
  );
  assert.deepEqual(names({ labelLayout: { width: 390 }, labels: false }), []);
  assert.deepEqual(
    names({
      labelLayout: { width: 390 },
      layers: { landmarks: false, roadLabels: false, neighborhoodLabels: false },
    }),
    [],
  );
  assert.equal(labels(createGuideSVG().svg).length, 0, 'legacy rendering stays the default');
});

test('static layout escapes names and validates before user callbacks', () => {
  const marker = { id: 'selected', label: '<script>&"', lng: -122.45, lat: 37.76, selected: true };
  const result = createGuideSVG({ markers: [marker], labelLayout: { width: 800 } });
  assert.ok(result.svg.includes('&lt;script&gt;'));
  assert.equal(labels(result.svg)[0].textContent, marker.label);
  for (const labelLayout of [
    null,
    false,
    {},
    { width: 0 },
    { width: -1 },
    { width: NaN },
    { width: Infinity },
    { width: '390' },
    { width: 390, unknown: true },
  ]) {
    let called = false;
    assert.throws(() =>
      renderMap(guideMapData, {
        labelLayout,
        districtStyle: () => {
          called = true;
          return {};
        },
      }),
    );
    assert.equal(called, false);
  }
});

test('compact layouts budget labels independently and preserve geometry and pins', () => {
  const options = {
    idPrefix: 'compact-test',
    markers: [
      { id: 'selected', label: 'A selected place', lng: -122.45, lat: 37.76, selected: true },
    ],
    labelLayout: {
      width: 800,
      maxLabels: 8,
      haloColor: '#102921',
      compact: { width: 480, maxLabels: 4 },
    },
  };
  const svg = createGuideSVG(options).svg;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const groups = Array.from(doc.getElementsByTagName('g')).filter((n) =>
    n.hasAttribute('data-label-layout'),
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.getElementsByTagName('text').length),
    [8, 4],
  );
  for (const group of groups) {
    const texts = Array.from(group.getElementsByTagName('text'));
    assert.equal(texts[0].textContent, 'A selected place');
    assert.ok(texts.every((n) => n.getAttribute('stroke') === '#102921'));
  }
  const withoutLabels = (text) =>
    text
      .replace(/<style>\[data-label-layout[\s\S]*?<\/style>/, '')
      .replace(
        /<g data-label-layout="[^"]+"><g data-layer="overview-labels"[\s\S]*?<\/g><\/g>/g,
        '',
      );
  assert.equal(withoutLabels(svg), createGuideSVG({ ...options, labels: false }).svg);
  assert.equal(labels(createGuideSVG({ labelLayout: { width: 390, maxLabels: 0 } }).svg).length, 0);
});

test('compact label options reject invalid budgets, widths and halo values', () => {
  for (const patch of [
    { maxLabels: -1 },
    { maxLabels: 1.5 },
    { maxLabels: NaN },
    { maxLabels: '4' },
    { haloColor: 123 },
    { compact: null },
    { compact: {} },
    { compact: { width: 800, maxLabels: 4 } },
    { compact: { width: 0, maxLabels: 4 } },
    { compact: { width: Infinity, maxLabels: 4 } },
    { compact: { width: 390, maxLabels: -1 } },
    { compact: { width: 390, maxLabels: 4, extra: true } },
  ])
    assert.throws(() => createGuideSVG({ labelLayout: { width: 800, ...patch } }));
  const haloColor = '"/><script>alert(1)</script>';
  const svg = createGuideSVG({ labelLayout: { width: 800, haloColor } }).svg;
  assert.ok(!svg.includes('<script>'));
  assert.ok(labels(svg).every((n) => n.getAttribute('stroke') === haloColor));
});
