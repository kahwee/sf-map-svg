import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { renderElectionChart, reportSteps } from '../../website/election/chart.js';

test('release chart uses only actual snapshots and horizontal/vertical cumulative steps', () => {
  assert.equal(
    reportSteps.line([
      [1, 5],
      [4, 2],
      [7, 3],
    ]),
    'M1,5H4V2H7V3',
  );
  const svg = renderElectionChart([54391, 57242, 64656], {
    share: false,
    batch: 2,
    unit: 'Observation',
    label: 'Yes reported votes',
  });
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  assert.equal(doc.getElementsByTagName('circle').length, 3);
  assert.ok(doc.getElementsByTagName('line').length >= 4);
  assert.match(svg, /Reported votes/);
  assert.match(svg, /Observation number/);
});
test('one report has one point and no fabricated connecting path', () => {
  const svg = renderElectionChart([50], {
    share: true,
    batch: 0,
    unit: 'Batch',
    label: 'Yes share',
  });
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  assert.equal(doc.getElementsByTagName('circle').length, 1);
  assert.equal(doc.getElementsByTagName('path').length, 0);
  assert.match(svg, /100%/);
});

test('comparison renders both actual series without extra observations', () => {
  const svg = renderElectionChart(
    [
      { values: [54, 57, 64], color: '#456' },
      { values: [91, 97, 109], color: '#765' },
    ],
    { share: false, unit: 'Observation', label: 'Yes and No reported votes' },
  );
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  assert.equal(doc.getElementsByTagName('circle').length, 6);
  assert.equal(doc.getElementsByTagName('path').length, 2);
  assert.match(svg, /Yes and No/);
});
