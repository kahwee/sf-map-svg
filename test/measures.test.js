import assert from 'node:assert/strict';
import test from 'node:test';
import election from '../data/elections/2026-06-02.json' with { type: 'json' };
import { passed, yesShare } from '../website/measures-model.js';

test('official district election counts reconcile to the certified citywide totals', () => {
  assert.deepEqual(
    election.measures.map((m) => m.id),
    ['A', 'B', 'C', 'D'],
  );
  const expected = [
    [203479, 48620],
    [132273, 117133],
    [83625, 162208],
    [118802, 132959],
  ];
  election.measures.forEach((m, i) => {
    assert.deepEqual([m.citywide.yes, m.citywide.no], expected[i]);
    assert.deepEqual(
      m.districts.map((d) => d.district),
      Array.from({ length: 11 }, (_, n) => n + 1),
    );
    for (const key of ['yes', 'no', 'undervotes', 'overvotes']) {
      assert(m.districts.every((d) => Number.isSafeInteger(d[key]) && d[key] >= 0));
      assert.equal(
        m.districts.reduce((sum, d) => sum + d[key], 0),
        m.citywide[key],
      );
    }
  });
  assert.deepEqual(election.measures.map(passed), [true, true, false, false]);
});
test('vote shares exclude blank responses and passage respects exact thresholds', () => {
  assert.equal(yesShare({ yes: 3, no: 1, undervotes: 50 }), 0.75);
  assert.equal(yesShare({ yes: 0, no: 0 }), null);
  assert.equal(passed({ threshold: 'majority', citywide: { yes: 50, no: 50 } }), false);
  assert.equal(passed({ threshold: 'two-thirds', citywide: { yes: 2, no: 1 } }), true);
  assert.equal(passed({ threshold: 'two-thirds', citywide: { yes: 66, no: 34 } }), false);
});

test('shared views validate URL input and preserve independent comparison controls', async () => {
  const { readView } = await import('../website/measures-model.js');
  assert.deepEqual(
    readView('#measure=D&district=8&compare=B&mode=no&labels=0', ['A', 'B', 'C', 'D']),
    { measure: 'D', district: 8, compare: 'B', mode: 'no', labels: false },
  );
  assert.deepEqual(
    readView('#measure=bad&district=Infinity&compare=A&mode=bad', ['A', 'B', 'C', 'D']),
    { measure: 'A', district: 0, compare: '', mode: 'yes', labels: true },
  );
});
test('CSV exports include citywide and district totals for both selected measures', async () => {
  const { resultsCsv } = await import('../website/measures-model.js');
  const csv = resultsCsv(election, election.measures.slice(0, 2));
  assert.equal(csv.trim().split('\r\n').length, 25);
  assert.match(csv, /"San Francisco","203479","48620","252099"/);
  assert.match(csv, /"District 11"/);
  assert.match(csv, /https:\/\/sfelections.org/);
  const quoted = structuredClone(election.measures[0]);
  quoted.title = 'Title with "quotes", comma';
  assert.match(resultsCsv(election, [quoted]), /"Title with ""quotes"", comma"/);
});
