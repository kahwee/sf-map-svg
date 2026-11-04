import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { appendMtcObservation, parseMtcResults, refreshMtc } from '../scripts/lib/mtc-results.mjs';
import { chooseSnapshotSeed, validateSnapshot } from '../website/election-model.js';

const seed = JSON.parse(
  await readFile(new URL('../elections/2026-11-03.json', import.meta.url), 'utf8'),
);
const html = await readFile(new URL('./fixtures/mtc/rtm-results.html', import.meta.url), 'utf8');
const contest = seed.contests.find((c) => c.id === 'RTM');
const observed = '2026-11-04T19:03:28Z';
test('MTC public table reconciles all five counties and retains unknown timezone literally', () => {
  const point = parseMtcResults(html, contest, observed);
  assert.deepEqual(point, contest.mediaUpdate);
  assert.deepEqual(
    point.options.map((o) => o.votes),
    [714460, 446326],
  );
  assert.equal(point.sourceUpdatedAt, null);
  assert.equal(point.sourceUpdatedAtText, 'Last updated 8:50 a.m., November 4');
  assert.equal(contest.mediaHistory.length, 6);
  assert.deepEqual(
    contest.mediaHistory.slice(0, 5).map((p) => p.options.map((o) => o.votes)),
    [
      [650366, 410598],
      [671876, 420043],
      [690335, 431242],
      [702848, 439585],
      [708996, 443928],
    ],
  );
  validateSnapshot(seed);
});
test('MTC parser rejects wrong election, duplicate counties, malformed counts and reconciliation failures', () => {
  for (const changed of [
    html.replace('November 3, 2026, statewide', 'November 3, 2024, statewide'),
    html.replace('Preliminary Results (Unofficial)', 'Final Results'),
    html.replace('<td>Alameda</td>', '<td>San Mateo</td>'),
    html.replace('193,325', '-193,325'),
    html.replace('193,325', '193,326'),
    html.replace('193,325', '193,326').replace('296,620', '296,621'),
    html.replace('8:50 a.m.', '25:50 a.m.'),
    html.replace('November 4</p>', 'November 44</p>'),
    html.replace('<th>Yes</th>', '<th>No</th>'),
    html.replace('<td>193,325</td>', '<td>1e6</td>'),
    html.replace('Last updated 8:50 a.m., November 4', 'Last updated 8:50 a.m., November 4 PST'),
  ])
    assert.throws(() => parseMtcResults(changed, contest, observed));
});
test('MTC repeated fetches deduplicate while changed cumulative counts preserve all prior observations', () => {
  const point = parseMtcResults(html, contest, '2026-11-04T19:13:28Z');
  assert.equal(appendMtcObservation(contest, point), contest);
  const revised = structuredClone(point);
  revised.options[0].votes++;
  const updated = appendMtcObservation(contest, revised);
  assert.equal(updated.mediaHistory.length, 7);
  assert.deepEqual(updated.mediaHistory.slice(0, 6), contest.mediaHistory);
  assert.equal(updated.mediaUpdate.sourceUpdatedAtText, contest.mediaUpdate.sourceUpdatedAtText);
  assert.throws(
    () => appendMtcObservation(contest, { ...point, observedAt: observed }),
    /not newer/,
  );
  const prior = structuredClone(seed);
  const old = prior.contests.find((c) => c.id === 'RTM');
  old.mediaHistory.pop();
  old.mediaUpdate = structuredClone(old.mediaHistory.at(-1));
  for (const recovered of [chooseSnapshotSeed(seed, prior), chooseSnapshotSeed(prior, seed)])
    assert.deepEqual(
      recovered.contests.find((c) => c.id === 'RTM').mediaHistory,
      contest.mediaHistory,
    );
});
test('MTC nullable time and source kind are confined to the exact RTM compilation', () => {
  for (const change of [
    (p) => (p.sourceUrl += '?other'),
    (p) => (p.sourceName = 'KQED'),
    (p) => (p.sourceKind = 'newsroom'),
    (p) => delete p.sourceUpdatedAtText,
    (p) => (p.sourceUpdatedAt = '2026-11-04T15:50:00Z'),
    (p) => (p.sourceUpdatedAtText = 'x'.repeat(1000)),
  ]) {
    const bad = structuredClone(seed);
    change(bad.contests.find((c) => c.id === 'RTM').mediaUpdate);
    assert.throws(() => validateSnapshot(bad));
  }
});

test('MTC refresh retains history on failure and never retries a recorded access denial', async () => {
  let calls = 0;
  const denied = await refreshMtc(
    contest,
    undefined,
    async () => {
      calls++;
      return { ok: false, status: 403, text: () => assert.fail('must not read denied body') };
    },
    () => '2026-11-04T19:13:28Z',
  );
  assert.equal(denied.contest, contest);
  assert.equal(denied.check.status, 'blocked');
  const skipped = await refreshMtc(contest, denied.check, () =>
    assert.fail('must not retry denied source'),
  );
  assert.equal(skipped.contest, contest);
  assert.equal(calls, 1);
  for (const fetcher of [
    async () => {
      throw new Error('offline');
    },
    async () => ({ ok: true, status: 200, text: async () => '<html>Changed format</html>' }),
  ]) {
    const failed = await refreshMtc(contest, undefined, fetcher, () => '2026-11-04T19:13:28Z');
    assert.equal(failed.contest, contest);
    assert.equal(failed.check.status, 'error');
  }
  const checked = await refreshMtc(
    contest,
    undefined,
    async () => ({ ok: true, status: 200, text: async () => html }),
    () => '2026-11-04T19:13:28Z',
  );
  assert.equal(checked.contest, contest);
  assert.equal(checked.check.status, 'ok');
});

test('MTC older publisher wall clock cannot overwrite the last-good observation', () => {
  const point = parseMtcResults(html, contest, '2026-11-04T19:13:28Z');
  point.sourceUpdatedAtText = 'Last updated 8:49 a.m., November 4';
  point.options[0].votes--;
  assert.throws(() => appendMtcObservation(contest, point), /Older MTC/);
});

test('MTC revision fixtures hold same-clock decreases and reversions, allowing later-clock corrections', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/mtc/revisions.json', import.meta.url), 'utf8'),
  );
  const base = structuredClone(contest.mediaUpdate);
  const earlier = { ...structuredClone(base), observedAt: '2026-11-04T19:01:00Z' };
  earlier.options = base.options.map((option, i) => ({ ...option, votes: fixture.earlier[i] }));
  const context = {
    ...contest,
    mediaHistory: [...contest.mediaHistory.slice(0, -1), earlier, base],
  };
  for (const scenario of fixture.cases) {
    const point = {
      ...structuredClone(base),
      observedAt: '2026-11-04T19:13:28Z',
      sourceUpdatedAtText: scenario.clock,
    };
    point.options = base.options.map((option, i) => ({ ...option, votes: scenario.votes[i] }));
    if (scenario.error)
      assert.throws(
        () => appendMtcObservation(context, point),
        new RegExp(scenario.error),
        scenario.name,
      );
    else {
      const updated = appendMtcObservation(context, point);
      assert.deepEqual(updated.mediaHistory.slice(0, -1), context.mediaHistory);
      assert.deepEqual(updated.mediaUpdate, point);
    }
  }
});

test('production updater has no MTC fetch activation', async () => {
  const updater = await readFile(
    new URL('../scripts/update-election.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(updater, /mtc-results|refreshMtc|mtc\.ca\.gov/);
});
