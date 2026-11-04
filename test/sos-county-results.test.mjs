import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseSosCounty, retainLastGood, sosMappings } from '../scripts/lib/sos-county-results.mjs';
import { validateSnapshot } from '../website/election-model.js';

const seed = JSON.parse(
  await readFile(new URL('../elections/2026-11-03.json', import.meta.url), 'utf8'),
);
const index = await readFile(new URL('./fixtures/sos/json-endpoints.csv', import.meta.url), 'utf8');
const files = new Map(
  await Promise.all(
    [...new Set(sosMappings.map((m) => m.file))].map(async (file) => [
      file,
      JSON.parse(await readFile(new URL(`./fixtures/sos/${file}.json`, import.meta.url), 'utf8')),
    ]),
  ),
);
const mapping = sosMappings[0];
const contest = seed.contests.find((c) => c.id === mapping.id);
const now = Date.parse('2026-11-04T05:00:00Z');
const zero = () => structuredClone(files.get(mapping.file));
function reported() {
  const rows = zero();
  const sf = rows.find((r) => r.raceTitle.includes('San Francisco County'));
  sf.ReportingTime = 'November 3, 2026, 8:45 p.m.';
  sf.candidates[0].Votes = '1,234';
  sf.candidates[1].Votes = '567';
  return rows;
}
test('actual official November zero-report fixtures stay pending for all 13 mapped contests', () => {
  for (const m of sosMappings) {
    const result = parseSosCounty(
      files.get(m.file),
      m,
      seed.contests.find((c) => c.id === m.id),
      index,
      now,
    );
    assert.equal(result.resultStatus, 'pending');
    assert.ok(result.options.every((o) => o.votes === null));
    assert.equal(result.sourceReportTime, 'November 2, 2026, 6:28 p.m.');
  }
});
test('post-poll synthetic mutation imports only county counts and preserves report text', () => {
  const rows = reported();
  rows.find((r) => r.raceTitle.includes('Statewide')).candidates[0].Votes = '999999';
  const result = parseSosCounty(rows, mapping, contest, index, now);
  assert.deepEqual(
    result.options.map((o) => o.votes),
    [1234, 567],
  );
  assert.equal(result.resultGeography.id, '06075');
  assert.deepEqual(result.regions, []);
  assert.equal(result.sourceReportTime, 'November 3, 2026, 8:45 p.m.');
  assert.equal(result.call, 'uncalled');
});
test('rejects wrong election, wrong county, duplicate rows, changed names and malformed counts', () => {
  assert.throws(() => parseSosCounty(zero(), mapping, contest, index.replace('2026', '2024'), now));
  for (const mutate of [
    (rows) =>
      rows.splice(
        rows.findIndex((r) => r.raceTitle.includes('San Francisco')),
        1,
      ),
    (rows) => rows.push(rows.find((r) => r.raceTitle.includes('San Francisco'))),
    (rows) => {
      rows.find((r) => r.raceTitle.includes('San Francisco')).candidates[0].Name = 'Unexpected';
    },
    (rows) => {
      rows.find((r) => r.raceTitle.includes('San Francisco')).candidates[0].Votes = '-2';
    },
  ]) {
    const rows = reported();
    mutate(rows);
    assert.throws(() => parseSosCounty(rows, mapping, contest, index, now));
  }
});
test('pre-poll execution and reset/older reports cannot publish or erase votes', () => {
  const incoming = parseSosCounty(reported(), mapping, contest, index, now);
  assert.ok(
    parseSosCounty(
      reported(),
      mapping,
      contest,
      index,
      Date.parse('2026-11-04T02:00:00Z'),
    ).options.every((o) => o.votes === null),
  );
  const pending = parseSosCounty(zero(), mapping, contest, index, now);
  assert.equal(retainLastGood(incoming, pending), incoming);
  assert.equal(
    retainLastGood(incoming, { ...incoming, sourceReportTime: 'November 3, 2026, 8:30 p.m.' }),
    incoming,
  );
});

test('partial county snapshots validate without inventing an SF Department report timestamp', () => {
  const result = parseSosCounty(reported(), mapping, contest, index, now);
  const data = structuredClone(seed);
  data.contests[data.contests.findIndex((c) => c.id === result.id)] = result;
  data.status = 'unofficial';
  data.checkStatus = 'partial';
  data.lastSuccessfulFetchAt = new Date(now).toISOString();
  validateSnapshot(data);
  assert.equal(data.sourceReportTimestamp, null);
  assert.ok(data.contests.find((c) => c.id === 'local-A').options.every((o) => o.votes === null));
});
