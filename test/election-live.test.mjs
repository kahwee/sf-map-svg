import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { latestMediaUpdate, mediaReportTime } from '../website/election-media.js';
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
    [64776, 109319],
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
    assert.equal(c.mediaHistory.length, 4);
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
  assert.equal(merged.contests.find((c) => c.id === 'local-G').mediaHistory.length, 4);
  const recovered = chooseSnapshotSeed(prior, seed);
  assert.equal(recovered.contests.find((c) => c.id === 'local-G').mediaHistory.length, 4);
  const bad = structuredClone(seed);
  bad.contests.find((c) => c.id === 'local-G').mediaHistory.reverse();
  assert.throws(() => validateSnapshot(bad), /media/);
});

test('RTM newsroom totals retain full five-county scope and observed projection time', () => {
  const c = seed.contests.find((c) => c.id === 'RTM');
  assert.deepEqual(
    c.mediaUpdate.options.map((o) => o.votes),
    [708996, 443928],
  );
  assert.equal(c.mediaUpdate.resultGeography.scope, 'full-contest');
  assert.equal(c.mediaUpdate.resultGeography.counties.length, 5);
  assert.equal(c.mediaUpdate.projection.publishedAt, undefined);
  assert.equal(c.mediaUpdate.projection.observedAt, '2026-11-04T06:39:42Z');
  assert.equal(c.mediaHistory.length, 5);
  assert.equal(c.mediaUpdate.sourceName, 'KQED');
  assert.equal(
    c.mediaUpdate.sourceUrl,
    'https://www.kqed.org/elections/results/california/regional-measure-rtm',
  );
  assert.equal(c.mediaUpdate.sourceUpdatedAt, '2026-11-04T08:59:00Z');
  assert.equal(c.mediaHistory[2].sourceUpdatedAt, '2026-11-04T07:27:00Z');
  assert.equal(c.mediaUpdate.observedAt, '2026-11-04T16:31:33Z');
  assert.ok(
    c.mediaHistory.slice(0, 2).every((point) => point.sourceName === 'San Francisco Chronicle'),
  );
  assert.deepEqual(c.mediaUpdate.projection, c.mediaHistory[0].projection);
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
      c.mediaUpdate.sourceName = 'San Francisco Chronicle';
    },
  ]) {
    const bad = structuredClone(seed);
    mutate(bad.contests.find((c) => c.id === 'RTM'));
    assert.throws(() => validateSnapshot(bad), /media/);
  }
});

test('10:50 p.m. newsroom observation retains every prior release and exact tallies', () => {
  const counts = [
    [122062, 50703],
    [85032, 85674],
    [137939, 34792],
    [100925, 73801],
    [115722, 57280],
    [109173, 64467],
    [64656, 109160],
    [125989, 47906],
    [76803, 93785],
    [134938, 35719],
    [671876, 420043],
  ];
  const ids = [...'ABCDEFGHIJ'].map((letter) => `local-${letter}`).concat('RTM');
  for (const [index, id] of ids.entries()) {
    const contest = seed.contests.find((c) => c.id === id);
    const observation = contest.mediaHistory[id === 'RTM' ? 1 : 2];
    assert.deepEqual(
      observation.options.map((o) => o.votes),
      counts[index],
    );
    assert.equal(observation.sourceUpdatedAt, '2026-11-04T06:50:00Z');
    assert.equal(observation.observedAt, '2026-11-04T06:51:51Z');
    assert.deepEqual(observation.projection, contest.mediaHistory[0].projection);
    assert.deepEqual(observation.resultGeography, contest.mediaHistory[0].resultGeography);
  }
});

test('11:53 p.m. KQED observation appends exact local counts without changing RTM or projections', () => {
  const counts = [
    [122226, 50809],
    [85175, 85805],
    [138152, 34852],
    [101064, 73937],
    [115890, 57388],
    [109328, 64585],
    [64776, 109319],
    [126168, 47995],
    [76936, 93917],
    [135129, 35793],
  ];
  for (const [index, letter] of [...'ABCDEFGHIJ'].entries()) {
    const contest = seed.contests.find((c) => c.id === `local-${letter}`);
    assert.equal(contest.mediaHistory.length, 4);
    assert.deepEqual(
      contest.mediaUpdate.options.map((o) => o.votes),
      counts[index],
    );
    assert.equal(contest.mediaUpdate.sourceName, 'KQED');
    assert.equal(contest.mediaUpdate.sourceUpdatedAt, '2026-11-04T07:53:00Z');
    assert.equal(contest.mediaUpdate.observedAt, '2026-11-04T08:07:39Z');
    assert.deepEqual(contest.mediaUpdate.projection, contest.mediaHistory[0].projection);
    assert.deepEqual(contest.resultHistory, []);
  }
  assert.equal(
    seed.contests.find((c) => c.id === 'RTM').mediaHistory[1].sourceUpdatedAt,
    '2026-11-04T06:50:00Z',
  );
});

test('KQED RTM requires the dedicated regional source and complete five-county scope', () => {
  const fixture = structuredClone(seed);
  const contest = fixture.contests.find((c) => c.id === 'RTM');
  const next = structuredClone(contest.mediaHistory[2]);
  Object.assign(next, {
    sourceName: 'KQED',
    sourceUrl: 'https://www.kqed.org/elections/results/california/regional-measure-rtm',
    sourceUpdatedAt: '2026-11-04T07:27:00Z',
    observedAt: '2026-11-04T08:10:04Z',
  });
  next.options[0].votes = 690335;
  next.options[1].votes = 431242;
  contest.mediaHistory = [...contest.mediaHistory.slice(0, 2), next];
  contest.mediaUpdate = next;
  validateSnapshot(fixture);
  assert.deepEqual(next.projection, contest.mediaHistory[0].projection);
  assert.deepEqual(next.resultGeography, contest.mediaHistory[0].resultGeography);
  for (const url of [
    'https://www.kqed.org/elections/results/sanfrancisco',
    'https://www.kqed.org/elections/results/california/unverified',
  ]) {
    const bad = structuredClone(fixture);
    bad.contests.find((c) => c.id === 'RTM').mediaUpdate.sourceUrl = url;
    assert.throws(() => validateSnapshot(bad), /media/);
  }
});

test('RTM permits only the documented future-dated publisher issue with unknown report time', () => {
  const fixture = structuredClone(seed);
  const contest = fixture.contests.find((c) => c.id === 'RTM');
  const point = structuredClone(contest.mediaUpdate);
  point.sourceUpdatedAt = null;
  point.sourceTimestampIssue = {
    type: 'future-dated',
    rawText: 'Updated at 11:27 PM PT on November 4, 2026',
  };
  point.observedAt = '2026-11-04T09:05:03Z';
  point.options[0].votes = 702848;
  point.options[1].votes = 439585;
  contest.mediaHistory = [...contest.mediaHistory.slice(0, 3), point];
  contest.mediaUpdate = point;
  validateSnapshot(fixture);
  assert.match(
    mediaReportTime(point, () => {
      throw new Error('Unknown date must not be formatted');
    }),
    /Report time unverified/,
  );
  assert.equal(latestMediaUpdate(point, contest.mediaHistory[0]), point);
  assert.equal(latestMediaUpdate(contest.mediaHistory[0], point), point);
  for (const mutate of [
    (p) => {
      delete p.sourceTimestampIssue;
    },
    (p) => {
      p.sourceTimestampIssue.rawText = 'corrected date';
    },
    (p) => {
      p.sourceTimestampIssue.type = 'unknown';
    },
    (p) => {
      p.sourceUpdatedAt = '2026-11-04T07:27:00Z';
    },
    (p) => {
      p.sourceName = 'San Francisco Chronicle';
    },
    (p) => {
      p.sourceUrl = 'https://www.kqed.org/elections/results/sanfrancisco';
    },
  ]) {
    const bad = structuredClone(fixture);
    mutate(bad.contests.find((c) => c.id === 'RTM').mediaUpdate);
    assert.throws(() => validateSnapshot(bad), /media/);
  }
});

test('RTM changed counts at the same publisher clock survive recovery as separate observations', () => {
  const current = seed.contests.find((c) => c.id === 'RTM');
  const previous = structuredClone(seed);
  const older = previous.contests.find((c) => c.id === 'RTM');
  older.mediaHistory.pop();
  older.mediaUpdate = structuredClone(older.mediaHistory.at(-1));
  assert.deepEqual(
    older.mediaUpdate.options.map((o) => o.votes),
    [702848, 439585],
  );
  assert.equal(older.mediaUpdate.sourceUpdatedAt, current.mediaUpdate.sourceUpdatedAt);
  assert.notEqual(older.mediaUpdate.observedAt, current.mediaUpdate.observedAt);
  for (const recovered of [
    chooseSnapshotSeed(seed, previous),
    chooseSnapshotSeed(previous, seed),
  ]) {
    validateSnapshot(recovered);
    const contest = recovered.contests.find((c) => c.id === 'RTM');
    assert.deepEqual(contest.mediaHistory, current.mediaHistory);
    assert.deepEqual(contest.mediaHistory.slice(0, 4), older.mediaHistory);
    assert.deepEqual(contest.mediaUpdate, current.mediaUpdate);
    assert.deepEqual(contest.options, older.options);
    assert.deepEqual(contest.resultHistory, older.resultHistory);
  }
});
