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

test('every measure has a concise official-guide explanation', () => {
  for (const c of seed.contests.filter((c) => c.kind === 'measure')) {
    assert.ok(c.shortTitle.length < 70);
    assert.ok(c.summary.length < 500);
    assert.match(c.summarySource.url, /^https:\/\//);
    assert.match(c.summarySource.pages, /^\d+(?:–\d+)?$/);
  }
});
test('new descriptions merge into unofficial snapshots without changing counts or provenance', () => {
  const previous = structuredClone(seed);
  previous.status = 'unofficial';
  previous.sourceReportTimestamp = '2026-11-04T04:45:00Z';
  previous.lastSuccessfulFetchAt = '2026-11-04T04:47:00Z';
  previous.contests[0].options[0].votes = 123;
  delete previous.contests[0].summary;
  delete previous.contests[0].shortTitle;
  delete previous.contests[0].summarySource;
  const merged = chooseSnapshotSeed(seed, previous);
  assert.equal(merged.contests[0].summary, seed.contests[0].summary);
  assert.deepEqual(merged.contests[0].options, previous.contests[0].options);
  assert.equal(merged.sourceReportTimestamp, previous.sourceReportTimestamp);
  assert.equal(previous.contests[0].summary, undefined);
  delete previous.contests[0].mediaUpdate;
  delete previous.contests[0].mediaHistory;
  previous.contests[0].options[0].id = 'different-option';
  assert.equal(chooseSnapshotSeed(seed, previous).contests[0].summary, undefined);
});

test('reviewed summaries retain material conditions without endorsements', () => {
  const summary = (id) => seed.contests.find((c) => c.id === id).summary;
  assert.match(summary('local-C'), /increases could be frozen/);
  assert.match(summary('local-F'), /unless the Board objects/);
  assert.match(summary('local-E'), /60 days without action/);
  assert.match(summary('local-H'), /\$129 per year/);
  assert.match(summary('state-38'), /at least half/);
  assert.match(summary('state-39'), /free voter ID/);
  assert.match(summary('state-40'), /administering the tax/);
  assert.match(summary('state-43'), /increases and extensions/);
  assert.match(summary('state-45'), /choose new/);
});

test('news tallies stay separate from official results and history', () => {
  const updates = seed.contests.filter((c) => c.mediaUpdate && c.id !== 'RTM');
  assert.equal(updates.length, 10);
  assert.equal(seed.status, 'pending');
  for (const c of updates) {
    assert.equal(c.call, 'uncalled');
    assert.ok(c.options.every((o) => o.votes === null));
    assert.deepEqual(c.resultHistory, []);
  }
  const g = updates.find((c) => c.id === 'local-G');
  assert.deepEqual(
    g.mediaUpdate.options.map((o) => o.votes),
    [57242, 97369],
  );
  assert.equal(g.mediaUpdate.projection.outcome, 'rejected');
  assert.equal(updates.filter((c) => c.mediaUpdate.projection).length, 1);
  for (const mutate of [
    (c) => {
      c.mediaUpdate.sourceUrl = 'https://unverified.example/';
    },
    (c) => {
      c.mediaUpdate.options[0].votes = -1;
    },
    (c) => {
      c.mediaUpdate.options[0].id = 'wrong';
    },
    (c) => {
      c.mediaUpdate.observedAt = '2026-11-04T03:00:00Z';
    },
    (c) => {
      c.mediaUpdate.projection.outcome = 'certified';
    },
  ]) {
    const bad = structuredClone(seed);
    mutate(bad.contests.find((c) => c.id === 'local-G'));
    assert.throws(() => validateSnapshot(bad), /media/);
  }
});
test('recovery preserves newer newsroom updates without creating official results', () => {
  const oldSeed = structuredClone(seed);
  delete oldSeed.contests.find((c) => c.id === 'local-G').mediaUpdate;
  delete oldSeed.contests.find((c) => c.id === 'local-G').mediaHistory;
  const recovered = chooseSnapshotSeed(oldSeed, seed);
  assert.deepEqual(
    recovered.contests.find((c) => c.id === 'local-G').mediaUpdate,
    seed.contests.find((c) => c.id === 'local-G').mediaUpdate,
  );
  assert.equal(recovered.status, 'pending');
});
test('newsroom history preserves publisher observations separately from official batches', () => {
  for (const c of seed.contests.filter((c) => c.mediaHistory && c.id !== 'RTM')) {
    assert.equal(c.mediaHistory.length, 2);
    assert.equal(c.mediaHistory[0].sourceName, 'KQED');
    assert.equal(c.mediaHistory[1].sourceName, 'San Francisco Chronicle');
    assert.deepEqual(c.mediaUpdate, c.mediaHistory.at(-1));
    assert.deepEqual(c.resultHistory, []);
  }
  const prior = structuredClone(seed);
  for (const c of prior.contests.filter((c) => c.mediaHistory)) {
    c.mediaUpdate = c.mediaHistory[0];
    delete c.mediaHistory;
  }
  const merged = chooseSnapshotSeed(seed, prior);
  assert.equal(merged.contests.find((c) => c.id === 'local-G').mediaHistory.length, 2);
  const recovered = chooseSnapshotSeed(prior, seed);
  assert.equal(recovered.contests.find((c) => c.id === 'local-G').mediaHistory.length, 2);
  const bad = structuredClone(seed);
  bad.contests.find((c) => c.id === 'local-G').mediaHistory.reverse();
  assert.throws(() => validateSnapshot(bad), /media/);
});

test('RTM newsroom totals retain full five-county scope and observed projection time', () => {
  const c = seed.contests.find((c) => c.id === 'RTM');
  assert.deepEqual(
    c.mediaUpdate.options.map((o) => o.votes),
    [650366, 410598],
  );
  assert.equal(c.mediaUpdate.resultGeography.scope, 'full-contest');
  assert.equal(c.mediaUpdate.resultGeography.counties.length, 5);
  assert.equal(c.mediaUpdate.projection.publishedAt, undefined);
  assert.equal(c.mediaUpdate.projection.observedAt, '2026-11-04T06:39:42Z');
  assert.equal(c.mediaHistory.length, 1);
  assert.deepEqual(c.resultHistory, []);
  assert.ok(c.options.every((o) => o.votes === null));
  assert.equal(c.call, 'uncalled');
  for (const mutate of [
    (c) => {
      c.mediaUpdate.resultGeography.counties = ['San Francisco'];
    },
    (c) => {
      c.mediaUpdate.resultGeography.scope = 'county-portion-of-contest';
    },
    (c) => {
      c.mediaUpdate.projection.publishedAt = '2026-11-04T06:36:00Z';
    },
    (c) => {
      c.mediaUpdate.sourceName = 'KQED';
    },
  ]) {
    const bad = structuredClone(seed);
    mutate(bad.contests.find((c) => c.id === 'RTM'));
    assert.throws(() => validateSnapshot(bad), /media/);
  }
});
