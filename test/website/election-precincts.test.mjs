import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { precinctMaps } from '@kahwee/sf-map-svg/data/precincts';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const index = await json('../../data/elections/precincts-index.json');
const aggregate = await json(`../../data/elections/${index.latest}`);
const boundaries = await json('../../data/precincts-2022.json');
// Each department summary report belongs to one snapshot; every snapshot is reconciled with its own report.
const reports = [
  { file: 'summary-report-5.json', stamp: '2026-11-04-143425', time: '11/4/2026 2:34:25 PM' },
  { file: 'summary-report-6.json', stamp: '2026-11-05-142202', time: '11/5/2026 2:22:02 PM' },
  { file: 'summary-report-7.json', stamp: '2026-11-06-135037', time: '11/6/2026 1:50:37 PM' },
];

test('the index lists every snapshot in time order and latest is the newest', async () => {
  const stamps = index.snapshots.map((s) => s.reportStamp);
  assert.deepEqual(stamps, [...stamps].sort());
  assert.equal(index.latest, index.snapshots.at(-1).file);
  for (const snapshot of index.snapshots) {
    const data = await json(`../../data/elections/${snapshot.file}`);
    assert.equal(data.source.reportStamp, snapshot.reportStamp);
    assert.equal(data.source.sourceReportTime, snapshot.sourceReportTime);
  }
});

test('every aggregated precinct has a 2022 boundary and no ballot-level fields', () => {
  const ids = new Set(boundaries.features.map((f) => f.properties.precinct));
  assert.equal(ids.size, 514);
  assert.equal(aggregate.geography.precinctsInManifest, 514);
  for (const id of Object.keys(aggregate.precincts)) assert.ok(ids.has(id), `precinct ${id}`);
  assert.deepEqual(Object.keys(aggregate).sort(), [
    'ballotCards',
    'contests',
    'electionDate',
    'geography',
    'method',
    'precincts',
    'schemaVersion',
    'source',
  ]);
  assert.equal(aggregate.source.reportStamp, index.snapshots.at(-1).reportStamp);
});

for (const report of reports) {
  test(`${report.time} precinct sums reconcile with its official summary report for every contest`, async () => {
    const summary = await json(`../fixtures/sfelections/${report.file}`);
    const snapshot = await json(`../../data/elections/precincts-${report.stamp}.json`);
    assert.equal(snapshot.source.sourceReportTime, report.time);
    assert.equal(snapshot.source.reportStamp, report.stamp);
    assert.equal(Object.keys(summary.contests).length, snapshot.contests.length);
    for (const [index, contest] of snapshot.contests.entries()) {
      const official = summary.contests[contest.id.trim()];
      assert.ok(official, contest.id);
      contest.options.forEach((option, i) => {
        const total = Object.values(snapshot.precincts).reduce(
          (n, p) => n + (p.c[index]?.[2 + i] ?? 0),
          0,
        );
        assert.equal(total, official[option.toUpperCase()] ?? 0, `${contest.id} / ${option}`);
      });
    }
  });
}

test('the package exports the frozen 2022 precinct boundaries', () => {
  const collection = precinctMaps[2022];
  assert.equal(collection.features.length, 514);
  assert.ok(Object.isFrozen(collection));
  assert.deepEqual(
    collection.features.map((f) => f.properties.precinct),
    boundaries.features.map((f) => f.properties.precinct),
  );
  assert.ok(collection.features.every((f) => f.id === `precinct-${f.properties.precinct}`));
});
