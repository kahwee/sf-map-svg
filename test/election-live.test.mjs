import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { freshness, parseOfficialReport, validateSnapshot } from '../website/election-model.js';

const seed = JSON.parse(
  await readFile(new URL('../elections/2026-11-03.json', import.meta.url), 'utf8'),
);
test('verified ballot has 25 measures and no invented counts or geography', () => {
  validateSnapshot(seed);
  assert.equal(seed.contests.filter((c) => c.kind === 'measure').length, 25);
  assert.equal(seed.ballotSource.candidateRosterComplete, false);
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
