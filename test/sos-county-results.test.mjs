import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  markSosFailure,
  parseSosCounty,
  retainLastGood,
  sosMappings,
} from '../scripts/lib/sos-county-results.mjs';
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
test('actual official November zero-report fixtures stay pending for all 40 mapped contests', () => {
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
  assert.throws(
    () => parseSosCounty(reported(), mapping, contest, index, Date.parse('2026-11-04T02:00:00Z')),
    /future/,
  );
  assert.ok(
    parseSosCounty(
      zero(),
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

test('propositions and eligible judicial retention use exact identities and Yes/No values', () => {
  for (const id of ['state-1', 'state-45', 'judicial-0', 'judicial-12']) {
    const m = sosMappings.find((m) => m.id === id);
    const c = seed.contests.find((c) => c.id === id);
    const rows = structuredClone(files.get(m.file));
    for (const row of rows) {
      row.ReportingTime = 'November 3, 2026, 8:45 p.m.';
      for (const item of row[m.category]) {
        item.yesVotes = '123';
        item.noVotes = '456';
      }
    }
    const result = parseSosCounty(rows, m, c, index, now);
    assert.deepEqual(
      result.options.map((o) => o.votes),
      [123, 456],
    );
    assert.equal(result.call, 'uncalled');
    const selectedTitle = m.raceTitle;
    for (const row of rows) row.raceTitle = selectedTitle.replace('San Francisco', 'San Mateo');
    assert.throws(() => parseSosCounty(rows, m, c, index, now));
  }
  assert.equal(sosMappings.length, 40);
});

test('future report clocks fail closed even when counts are zero', () => {
  for (const time of ['November 3, 2026, 9:01 p.m.', 'December 1, 2026, 6:28 p.m.']) {
    const rows = zero();
    rows.find((r) => r.raceTitle.includes('San Francisco')).ReportingTime = time;
    assert.throws(() => parseSosCounty(rows, mapping, contest, index, now), /future/);
  }
});
test('a total SOS outage marks every supported contest failed without erasing last-good counts', () => {
  const data = structuredClone(seed);
  const result = parseSosCounty(reported(), mapping, contest, index, now);
  data.contests[data.contests.findIndex((c) => c.id === result.id)] = result;
  const failed = markSosFailure(data, new Date(now + 600000).toISOString());
  const retained = failed.contests.find((c) => c.id === result.id);
  assert.deepEqual(retained.options, result.options);
  assert.equal(retained.sourceReportTime, result.sourceReportTime);
  assert.equal(retained.resultsFetchedAt, result.resultsFetchedAt);
  assert.equal(failed.contests.filter((c) => c.resultCheckStatus === 'error').length, 40);
  assert.equal(failed.contests.find((c) => c.id === 'local-A').resultCheckStatus, undefined);
});

test('history records actual batches once and retains same-time corrected revisions', () => {
  const first = retainLastGood(contest, parseSosCounty(reported(), mapping, contest, index, now));
  assert.equal(first.resultHistory.length, 1);
  const repeated = retainLastGood(
    first,
    parseSosCounty(reported(), mapping, first, index, now + 600000),
  );
  assert.equal(repeated.resultHistory.length, 1);
  assert.equal(repeated.resultHistory[0].observedAt, new Date(now).toISOString());
  const revisedRows = reported();
  revisedRows.find((r) => r.raceTitle.includes('San Francisco')).candidates[0].Votes = '1,230';
  const revised = retainLastGood(
    repeated,
    parseSosCounty(revisedRows, mapping, repeated, index, now + 1200000),
  );
  assert.equal(revised.resultHistory.length, 2);
  assert.equal(revised.resultHistory[1].sourceReportTime, first.sourceReportTime);
  assert.equal(revised.resultHistory[1].options[0].votes, 1230);
  const newerRows = reported();
  newerRows.find((r) => r.raceTitle.includes('San Francisco')).ReportingTime =
    'November 3, 2026, 9:45 p.m.';
  const next = retainLastGood(
    revised,
    parseSosCounty(newerRows, mapping, revised, index, now + 3600000),
  );
  assert.equal(next.resultHistory.length, 3);
  assert.deepEqual(next.resultHistory.slice(0, 2), revised.resultHistory);
  assert.deepEqual(retainLastGood(next, first), next);
});
test('zero reports never create history and outages preserve historical values', () => {
  const pending = retainLastGood(contest, parseSosCounty(zero(), mapping, contest, index, now));
  assert.deepEqual(pending.resultHistory, []);
  const first = retainLastGood(contest, parseSosCounty(reported(), mapping, contest, index, now));
  assert.equal(retainLastGood(first, pending), first);
  const data = { ...seed, contests: seed.contests.map((c) => (c.id === first.id ? first : c)) };
  assert.deepEqual(
    markSosFailure(data, new Date(now + 600000).toISOString()).contests.find(
      (c) => c.id === first.id,
    ).resultHistory,
    first.resultHistory,
  );
});
test('history rejects wrong county, pre-poll timestamps, nulls and duplicate observations', () => {
  const result = retainLastGood(contest, parseSosCounty(reported(), mapping, contest, index, now));
  const data = {
    ...seed,
    status: 'unofficial',
    lastSuccessfulFetchAt: new Date(now).toISOString(),
    contests: seed.contests.map((c) => (c.id === result.id ? result : c)),
  };
  validateSnapshot(data);
  for (const mutate of [
    (p) => {
      p.resultGeography.id = '06081';
    },
    (p) => {
      p.sourceReportTime = 'November 2, 2026, 6:28 p.m.';
    },
    (p) => {
      p.options[0].votes = null;
    },
    (p) => {
      p.observedAt = '2026-11-04T03:00:00Z';
    },
    (p) => {
      p.reporting = '200% (1000 of 514) precincts reporting';
    },
  ]) {
    const bad = structuredClone(data);
    mutate(bad.contests.find((c) => c.id === result.id).resultHistory[0]);
    assert.throws(() => validateSnapshot(bad));
  }
  const bad = structuredClone(data);
  const h = bad.contests.find((c) => c.id === result.id).resultHistory;
  h.push(structuredClone(h[0]));
  assert.throws(() => validateSnapshot(bad));
});
