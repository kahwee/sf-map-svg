import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const index = await json('../data/elections/precincts-index.json');
const aggregate = await json(`../data/elections/${index.latest}`);
const boundaries = await json('../data/precincts-2022.json');
const summary = await readFile(
  new URL('./fixtures/sfelections/summary-report-4.xml', import.meta.url),
  'utf8',
);

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
  const decode = (name) => name.replaceAll('&quot;', '"').trim().toUpperCase();
  const blocks = summary.split('<ContestIdGroup contestId="').slice(1);
  assert.equal(blocks.length, aggregate.contests.length);
  for (const block of blocks) {
    const name = block.slice(0, block.indexOf('"')).trim();
    const contest = aggregate.contests.find((c) => c.id.trim() === name);
    assert.ok(contest, name);
    const official = new Map(
      [
        ...block.matchAll(
          /candidateNameTextBox4="([^"]*)"[^>]*>(?:(?!<candidateNameTextBox4).)*?vot8="(\d+)"/gs,
        ),
      ].map((m) => [decode(m[1]), Number(m[2])]),
    );
    contest.options.forEach((option, i) => {
      const total = Object.values(aggregate.precincts).reduce(
        (n, p) => n + (p.contests[contest.id]?.votes[i] ?? 0),
        0,
      );
      if (official.has(option.toUpperCase()))
        assert.equal(total, official.get(option.toUpperCase()), `${name} / ${option}`);
      else assert.equal(total, 0, `${name} / ${option} is absent from the summary`);
    });
  }
});
