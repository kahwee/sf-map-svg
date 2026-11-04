import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadPreviousSnapshot } from '../scripts/lib/previous-election.mjs';
import { parseSosCounty, retainLastGood, sosMappings } from '../scripts/lib/sos-county-results.mjs';

const seed = JSON.parse(
  await readFile(new URL('../elections/2026-11-03.json', import.meta.url), 'utf8'),
);
test('failed prior snapshot recovery aborts instead of resetting deployed results', async () => {
  for (const fetcher of [
    async () => {
      throw new Error('offline');
    },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ ...seed, electionDate: '2024-11-05' }) }),
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad JSON');
      },
    }),
  ])
    await assert.rejects(loadPreviousSnapshot(seed, fetcher), /refusing publication/);
});
test('recovered history survives verified metadata updates', async () => {
  const mapping = sosMappings[0];
  const contest = seed.contests.find((c) => c.id === mapping.id);
  const index = await readFile(
    new URL('./fixtures/sos/json-endpoints.csv', import.meta.url),
    'utf8',
  );
  const rows = JSON.parse(
    await readFile(new URL('./fixtures/sos/governor.json', import.meta.url), 'utf8'),
  );
  const row = rows.find((r) => r.raceTitle.includes('San Francisco'));
  row.ReportingTime = 'November 3, 2026, 8:01 p.m.';
  row.candidates[0].Votes = '12';
  const result = retainLastGood(
    contest,
    parseSosCounty(rows, mapping, contest, index, Date.parse('2026-11-04T04:02:00Z')),
  );
  const deployed = {
    ...structuredClone(seed),
    status: 'unofficial',
    lastSuccessfulFetchAt: '2026-11-04T04:02:00Z',
  };
  deployed.contests[deployed.contests.findIndex((c) => c.id === contest.id)] = result;
  deployed.contests.find((c) => c.id === 'local-C').summary = 'Earlier verified description';
  const recovered = await loadPreviousSnapshot(seed, async () => ({
    ok: true,
    json: async () => deployed,
  }));
  assert.deepEqual(
    recovered.contests.find((c) => c.id === contest.id).resultHistory,
    result.resultHistory,
  );
  assert.deepEqual(recovered.contests.find((c) => c.id === contest.id).options, result.options);
  assert.equal(
    recovered.contests.find((c) => c.id === 'local-C').summary,
    seed.contests.find((c) => c.id === 'local-C').summary,
  );
});
