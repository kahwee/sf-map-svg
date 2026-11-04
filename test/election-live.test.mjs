import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  chooseSnapshotSeed,
  freshness,
  parseOfficialReport,
  validateSnapshot,
} from '../website/election-model.js';

const seed = JSON.parse(
  await readFile(new URL('../elections/2026-11-03.json', import.meta.url), 'utf8'),
);
test('verified ballot has 25 measures and no invented counts or geography', () => {
  validateSnapshot(seed);
  assert.equal(seed.contests.filter((c) => c.kind === 'measure').length, 25);
  assert.equal(seed.ballotSource.candidateRosterComplete, true);
  assert.ok(
    seed.contests.every((c) => c.options.every((o) => o.votes === null) && c.regions.length === 0),
  );
});
test('rejects historical elections, fabricated counts, geography and calls', () => {
  for (const mutate of [
    (d) => {
      d.electionDate = '2026-06-02';
    },
    (d) => {
      d.contests[0].options[0].votes = 0;
    },
    (d) => {
      d.contests[0].options[0].votes = -1;
    },
    (d) => {
      d.contests[0].regions = [{ district: 1 }];
    },
    (d) => {
      d.contests[0].call = 'winner';
    },
    (d) => {
      d.sourceReportTimestamp = 'today';
    },
  ]) {
    const copy = structuredClone(seed);
    mutate(copy);
    assert.throws(() => validateSnapshot(copy));
  }
});
test('distinguishes stale checks, source errors and successful checks', () => {
  const now = Date.parse('2026-11-04T02:00:00Z');
  assert.equal(freshness(seed, now), 'stale');
  const copy = { ...seed, checkedAt: new Date(now).toISOString(), checkStatus: 'error' };
  assert.equal(freshness(copy, now), 'source-error');
  assert.equal(freshness({ ...copy, checkStatus: 'ok' }, now), 'current');
  assert.equal(freshness(copy, now + 31 * 60_000), 'stale');
});
test('official parser fails closed for challenge, wrong election and unverified format', () => {
  for (const html of ['403 ERROR', 'June 2, 2026', 'November 3, 2026 — unknown format'])
    assert.throws(() => parseOfficialReport(html));
});

test('displayed rosters include candidates without pamphlet statements and verified statewide candidates', () => {
  assert.equal(seed.ballotSource.displayedCandidateContestsComplete, true);
  assert.equal(seed.ballotSource.candidateRosterComplete, true);
  const candidates = seed.contests.filter((c) => c.kind === 'candidate');
  assert.equal(candidates.length, 24);
  assert.equal(
    candidates.reduce((sum, c) => sum + c.options.length, 0),
    69,
  );
  for (const name of [
    'Charles Hoelter',
    'Manuel Noris-Barrera',
    'Philip Louis Wing',
    'Nicholas Berg',
    'Jamo Muhammad',
  ])
    assert.ok(candidates.some((c) => c.options.some((o) => o.label === name)));
});

test('a deployed pending ballot cannot erase newly verified candidates', () => {
  const previous = structuredClone(seed);
  previous.contests.find((c) => c.title === 'Board of Supervisors, District 2').options.pop();
  previous.ballotSource.displayedCandidateContestsComplete = false;
  const selected = chooseSnapshotSeed(seed, previous);
  assert.equal(selected.ballotSource.displayedCandidateContestsComplete, true);
  assert.equal(
    selected.contests.find((c) => c.title === 'Board of Supervisors, District 2').options.length,
    4,
  );
  const reported = structuredClone(previous);
  reported.status = 'unofficial';
  reported.sourceReportTimestamp = '2026-11-04T04:45:00Z';
  reported.lastSuccessfulFetchAt = '2026-11-04T04:47:00Z';
  reported.contests[0].options[0].votes = 123;
  assert.equal(chooseSnapshotSeed(seed, reported).contests[0].options[0].votes, 123);
});

test('judicial retention includes only San Francisco-eligible courts', () => {
  const judicial = seed.contests.filter((c) => c.kind === 'judicial-retention');
  assert.equal(judicial.length, 13);
  assert.equal(seed.contests.length, 62);
  assert.ok(judicial.every((c) => /Supreme Court|First District/.test(c.title)));
  assert.ok(judicial.every((c) => c.options.map((o) => o.label).join(',') === 'Yes,No'));
  assert.match(seed.ballotSource.candidateRosterScope, /write-in/);
});
