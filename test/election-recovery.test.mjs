import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  latestSuccessfulDeployment,
  loadPreviousSnapshot,
  verifyDeploymentSnapshot,
} from '../scripts/lib/previous-election.mjs';
import { parseSosCounty, retainLastGood, sosMappings } from '../scripts/lib/sos-county-results.mjs';

const deployment = {
  id: 1,
  headSha: 'a'.repeat(40),
  createdAt: '2026-11-04T04:00:00Z',
  startedAt: '2026-11-04T04:01:00Z',
  completedAt: '2026-11-04T04:05:00Z',
};
const deploymentReader = async () => deployment;
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
    await assert.rejects(
      loadPreviousSnapshot(seed, fetcher, deploymentReader),
      /refusing publication/,
    );
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
    checkedAt: '2026-11-04T04:02:00Z',
    generatedAt: '2026-11-04T04:02:01Z',
    buildCommit: deployment.headSha,
  };
  deployed.contests[deployed.contests.findIndex((c) => c.id === contest.id)] = result;
  deployed.contests.find((c) => c.id === 'local-C').summary = 'Earlier verified description';
  const recovered = await loadPreviousSnapshot(
    seed,
    async () => ({
      ok: true,
      json: async () => deployed,
    }),
    deploymentReader,
  );
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

test('same-commit stale CDN snapshots cannot roll history back', () => {
  const snapshot = {
    ...seed,
    buildCommit: deployment.headSha,
    checkedAt: '2026-11-04T04:02:00Z',
    generatedAt: '2026-11-04T04:02:01Z',
  };
  assert.equal(verifyDeploymentSnapshot(snapshot, deployment), snapshot);
  assert.throws(
    () =>
      verifyDeploymentSnapshot(
        { ...snapshot, checkedAt: '2026-11-04T04:00:30Z', generatedAt: '2026-11-04T04:00:31Z' },
        deployment,
      ),
    /history rollback/,
  );

  assert.throws(
    () =>
      verifyDeploymentSnapshot(
        { ...snapshot, checkedAt: '2026-11-04T03:52:00Z', generatedAt: '2026-11-04T03:52:01Z' },
        deployment,
      ),
    /history rollback/,
  );
  assert.throws(
    () => verifyDeploymentSnapshot({ ...snapshot, buildCommit: 'b'.repeat(40) }, deployment),
    /history rollback/,
  );
});
test('deployment guard skips nonpublishing runs and recognizes successful deploys in failed overall runs', async () => {
  const calls = [];
  const latest = await latestSuccessfulDeployment(async (url) => {
    calls.push(url);
    if (url.includes('/workflows/'))
      return {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 3,
              head_sha: deployment.headSha,
              created_at: deployment.createdAt,
              updated_at: deployment.completedAt,
              conclusion: 'failure',
            },
            {
              id: 2,
              head_sha: deployment.headSha,
              created_at: deployment.createdAt,
              updated_at: deployment.completedAt,
              conclusion: 'failure',
            },
          ],
        }),
      };
    return {
      ok: true,
      json: async () => ({
        total_count: 2,
        jobs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            started_at: deployment.startedAt,
          },
          {
            name: 'deploy',
            status: 'completed',
            conclusion: url.includes('/3/') ? 'skipped' : 'success',
            completed_at: deployment.completedAt,
          },
        ],
      }),
    };
  });
  assert.equal(latest.id, 2);
  assert.equal(calls.length, 3);
  await assert.rejects(
    latestSuccessfulDeployment(async () => ({ ok: false, status: 403 })),
    /metadata HTTP 403/,
  );
});
test('unavailable deployment metadata aborts before fetching or replacing prior history', async () => {
  let fetched = false;
  await assert.rejects(
    loadPreviousSnapshot(
      seed,
      async () => {
        fetched = true;
      },
      async () => {
        throw new Error('metadata unavailable');
      },
    ),
    /refusing publication/,
  );
  assert.equal(fetched, false);
});

test('lagging workflow metadata fails closed before reading an older deployed file', async () => {
  await assert.rejects(
    latestSuccessfulDeployment(
      async () => ({ ok: true, json: async () => ({ workflow_runs: [{ run_number: 8 }] }) }),
      { previousRunNumber: 9 },
    ),
    /preceding workflow/,
  );
});
