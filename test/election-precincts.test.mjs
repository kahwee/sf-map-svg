import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { precinctMaps } from '@kahwee/sf-map-svg/data/precincts';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const index = await json('../data/elections/precincts-index.json');
const aggregate = await json(`../data/elections/${index.latest}`);
const boundaries = await json('../data/precincts-2022.json');
const summary = await json('./fixtures/sfelections/summary-report-4.json');

test('the index lists every snapshot in time order and latest is the newest', async () => {
  const stamps = index.snapshots.map((s) => s.reportStamp);
  assert.deepEqual(stamps, [...stamps].sort());
  assert.equal(index.latest, index.snapshots.at(-1).file);
  for (const snapshot of index.snapshots) {
    const data = await json(`../data/elections/${snapshot.file}`);
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
  assert.equal(aggregate.source.sourceReportTime, '11/3/2026 11:04:21 PM');
  assert.equal(aggregate.source.reportStamp, '2026-11-03-230421');
});

test('precinct sums reconcile with the official summary report for every contest', () => {
  const names = Object.keys(summary.contests);
  assert.equal(names.length, aggregate.contests.length);
  for (const [index, contest] of aggregate.contests.entries()) {
    const official = summary.contests[contest.id.trim()];
    assert.ok(official, contest.id);
    contest.options.forEach((option, i) => {
      const total = Object.values(aggregate.precincts).reduce(
        (n, p) => n + (p.c[index]?.[2 + i] ?? 0),
        0,
      );
      assert.equal(total, official[option.toUpperCase()] ?? 0, `${contest.id} / ${option}`);
    });
  }
});

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
