import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  latestSuccessfulDeployment,
  loadPreviousSnapshot,
  verifyDeploymentSnapshot,
} from '../../scripts/data/election/previous-deployment.mjs';
import {
  parseSosCounty,
  retainLastGood,
  sosMappings,
} from '../../scripts/data/election/sos-county-results.mjs';

const deployment = {
  id: 1,
  headSha: 'a'.repeat(40),
  createdAt: '2026-11-04T04:00:00Z',
  startedAt: '2026-11-04T04:01:00Z',
  completedAt: '2026-11-04T04:05:00Z',
};
const deploymentReader = async () => deployment;
const seed = JSON.parse(
  await readFile(new URL('../../elections/2026-11-03.json', import.meta.url), 'utf8'),
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
    new URL('../fixtures/sos/json-endpoints.csv', import.meta.url),
    'utf8',
  );
  const rows = JSON.parse(
    await readFile(new URL('../fixtures/sos/governor.json', import.meta.url), 'utf8'),
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

test('metadata failure retains only bounded typed response diagnostics and stops recovery', async () => {
  const allowed = {
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': '0',
    'x-ratelimit-used': '60',
    'x-ratelimit-reset': '1793797200',
    'retry-after': '120',
    date: 'Wed, 04 Nov 2026 12:33:52 GMT',
    'x-ratelimit-resource': 'core',
  };
  let requests = 0;
  const response = {
    ok: false,
    status: 403,
    headers: {
      get(name) {
        assert.ok(Object.hasOwn(allowed, name));
        return allowed[name];
      },
    },
  };
  for (const name of ['body', 'json', 'text', 'statusText', 'url'])
    Object.defineProperty(response, name, {
      get() {
        assert.fail(`must not read ${name}`);
      },
    });
  await assert.rejects(
    loadPreviousSnapshot(seed, async () => {
      requests += 1;
      return response;
    }),
    (error) => {
      assert.match(error.message, /refusing publication/);
      assert.equal(
        error.cause.message,
        `Public deployment metadata HTTP 403; diagnostics=${JSON.stringify({ request: 'workflow-list', ...allowed })}`,
      );
      assert.ok(error.cause.message.length < 600);
      return true;
    },
  );
  assert.equal(requests, 1, 'no retry or snapshot fetch after metadata failure');
});

test('metadata diagnostics omit malformed, oversized and sensitive header values', async () => {
  const values = {
    'x-ratelimit-limit': 'secret-token',
    'x-ratelimit-remaining': '-1',
    'x-ratelimit-used': '1\ninjected',
    'x-ratelimit-reset': '9'.repeat(1000),
    'retry-after': 'Wed, 99 Nov 2026 12:33:52 GMT',
    date: 'Thu, 04 Nov 2026 12:33:52 GMT',
    'x-ratelimit-resource': 'secret-token',
    authorization: 'secret-token',
    'set-cookie': 'secret-token',
  };
  await assert.rejects(
    latestSuccessfulDeployment(async () => ({
      ok: false,
      status: 'secret-token',
      headers: { get: (name) => values[name] },
    })),
    { message: 'Public deployment metadata HTTP unknown; diagnostics={"request":"workflow-list"}' },
  );
});

test('metadata jobs failure identifies the request and preserves canonical retry dates', async () => {
  let requests = 0;
  await assert.rejects(
    latestSuccessfulDeployment(async () => {
      requests += 1;
      if (requests === 1)
        return {
          ok: true,
          json: async () => ({
            workflow_runs: [
              {
                id: 1,
                head_sha: deployment.headSha,
                created_at: deployment.createdAt,
                updated_at: deployment.completedAt,
              },
            ],
          }),
        };
      return {
        ok: false,
        status: 503,
        headers: new Headers({
          'retry-after': 'Wed, 04 Nov 2026 12:35:52 GMT',
        }),
      };
    }),
    {
      message:
        'Public deployment metadata HTTP 503; diagnostics={"request":"run-jobs","retry-after":"Wed, 04 Nov 2026 12:35:52 GMT"}',
    },
  );
  assert.equal(requests, 2, 'no automatic retry of the failed jobs request');
});

test('election probes do not interpret their run number as a Pages run number', async (t) => {
  const probe = process.env.ELECTION_PROBE;
  const run = process.env.GITHUB_RUN_NUMBER;
  t.after(() => {
    if (probe === undefined) delete process.env.ELECTION_PROBE;
    else process.env.ELECTION_PROBE = probe;
    if (run === undefined) delete process.env.GITHUB_RUN_NUMBER;
    else process.env.GITHUB_RUN_NUMBER = run;
  });
  process.env.ELECTION_PROBE = 'true';
  process.env.GITHUB_RUN_NUMBER = '500';
  let requested;
  await assert.rejects(
    loadPreviousSnapshot(
      seed,
      async () => {
        throw new Error('offline');
      },
      async (_fetch, options) => {
        requested = options.previousRunNumber;
        return deployment;
      },
    ),
  );
  assert.equal(requested, null);
  process.env.ELECTION_PROBE = 'false';
  await assert.rejects(
    loadPreviousSnapshot(
      seed,
      async () => {
        throw new Error('offline');
      },
      async (_fetch, options) => {
        requested = options.previousRunNumber;
        return deployment;
      },
    ),
  );
  assert.equal(requested, 499);
});

test('late cleanup cannot make an older deployment the recovery source', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.includes('/workflows/'))
      return {
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 1,
              head_sha: deployment.headSha,
              created_at: deployment.createdAt,
              updated_at: '2026-11-04T05:00:00Z',
            },
            {
              id: 2,
              head_sha: 'b'.repeat(40),
              created_at: '2026-11-04T04:10:00Z',
              updated_at: '2026-11-04T04:20:00Z',
            },
            {
              id: 3,
              head_sha: 'c'.repeat(40),
              created_at: '2026-11-04T03:00:00Z',
              updated_at: '2026-11-04T03:20:00Z',
            },
          ],
        }),
      };
    const newer = url.includes('/2/');
    return {
      ok: true,
      json: async () => ({
        total_count: 2,
        jobs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            started_at: newer ? '2026-11-04T04:11:00Z' : deployment.startedAt,
          },
          {
            name: 'deploy',
            status: 'completed',
            conclusion: 'success',
            completed_at: newer ? '2026-11-04T04:19:00Z' : deployment.completedAt,
          },
        ],
      }),
    };
  };
  const latest = await latestSuccessfulDeployment(fetcher);
  assert.equal(latest.id, 2);
  assert.equal(
    calls.length,
    3,
    'older metadata cannot beat selected completion; avoid unnecessary API requests',
  );
  assert.throws(
    () =>
      verifyDeploymentSnapshot(
        {
          ...seed,
          buildCommit: deployment.headSha,
          checkedAt: '2026-11-04T04:02:00Z',
          generatedAt: '2026-11-04T04:03:00Z',
        },
        latest,
      ),
    /history rollback/,
  );
});

test('inconsistent completion timestamps fail closed rather than select a candidate', async () => {
  for (const completedAt of ['2026-11-04T05:00:00Z', '2026-11-04T04:00:30Z']) {
    await assert.rejects(
      latestSuccessfulDeployment(async (url) => ({
        ok: true,
        json: async () =>
          url.includes('/workflows/')
            ? {
                workflow_runs: [
                  {
                    id: 1,
                    head_sha: deployment.headSha,
                    created_at: deployment.createdAt,
                    updated_at: deployment.completedAt,
                  },
                ],
              }
            : {
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
                    conclusion: 'success',
                    completed_at: completedAt,
                  },
                ],
              },
      })),
      /Invalid deployment/,
    );
  }
});

test('equal deployment completions remain ambiguous even at the metadata cutoff', async () => {
  let calls = 0;
  await assert.rejects(
    latestSuccessfulDeployment(async (url) => {
      calls++;
      if (url.includes('/workflows/'))
        return {
          ok: true,
          json: async () => ({
            workflow_runs: [1, 2].map((id) => ({
              id,
              head_sha: deployment.headSha,
              created_at: deployment.createdAt,
              updated_at: id === 1 ? '2026-11-04T05:00:00Z' : deployment.completedAt,
            })),
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
              conclusion: 'success',
              completed_at: deployment.completedAt,
            },
          ],
        }),
      };
    }),
    /Ambiguous latest deployment completion/,
  );
  assert.equal(calls, 3, 'equal upper bound must still be inspected');
});

test('unfiltered discovery recovers omitted completion without inspecting its own running job', async () => {
  const calls = [];
  const recovered = await latestSuccessfulDeployment(async (url) => {
    calls.push(url);
    assert.ok(!url.includes('status=completed'), 'do not use incomplete filtered index');
    if (url.includes('/workflows/')) return { ok: true, json: async () => ({ workflow_runs: [
      { id: 3, run_number: 271, status: 'in_progress' },
      { id: 2, run_number: 270, status: 'completed', head_sha: deployment.headSha,
        created_at: deployment.createdAt, updated_at: deployment.completedAt },
    ] }) };
    assert.ok(url.includes('/2/'), 'only the verified prior run should be inspected');
    return { ok: true, json: async () => ({ total_count: 2, jobs: [
      { name: 'build', status: 'completed', conclusion: 'success', started_at: deployment.startedAt },
      { name: 'deploy', status: 'completed', conclusion: 'success', completed_at: deployment.completedAt },
    ] }) };
  }, { previousRunNumber: 270, currentRunId: 3 });
  assert.equal(recovered.id, 2);
  assert.equal(calls.length, 2);
});

test('unfiltered discovery still rejects another incomplete run', async () => {
  await assert.rejects(latestSuccessfulDeployment(async (url) => ({ ok: true, json: async () =>
    url.includes('/workflows/') ? { workflow_runs: [{ id: 2, run_number: 270,
      head_sha: deployment.headSha, created_at: deployment.createdAt, updated_at: deployment.completedAt }] }
      : { total_count: 1, jobs: [{ name: 'deploy', status: 'in_progress', conclusion: null }] }
  }), { currentRunId: 3 }), /Incomplete deployment jobs/);
});
