import { chooseSnapshotSeed, validateSnapshot } from '../../website/election/model.js';

const api = 'https://api.github.com/repos/kahwee/sf-map-svg/actions';
// Log only fixed request labels and strictly typed, allowlisted response headers.
// Never read the body, status text, response URL, cookies or request headers.
function metadataFailure(response, request) {
  const diagnostics = { request };
  const numeric = [
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-used',
    'x-ratelimit-reset',
  ];
  for (const name of [...numeric, 'retry-after', 'date', 'x-ratelimit-resource']) {
    const value = response.headers?.get(name);
    if (typeof value !== 'string' || value.length > 40) continue;
    const integer = /^\d{1,10}$/.test(value);
    const httpDate =
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
        value,
      ) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toUTCString() === value;
    if (
      (numeric.includes(name) && integer) ||
      (name === 'retry-after' && (integer || httpDate)) ||
      (name === 'date' && httpDate) ||
      (name === 'x-ratelimit-resource' && value === 'core')
    )
      diagnostics[name] = value;
  }
  const status =
    Number.isInteger(response.status) && response.status >= 100 && response.status <= 599
      ? response.status
      : 'unknown';
  return new Error(
    `Public deployment metadata HTTP ${status}; diagnostics=${JSON.stringify(diagnostics)}`,
  );
}

export async function latestSuccessfulDeployment(
  fetcher = fetch,
  { previousRunNumber = null } = {},
) {
  async function read(url, request) {
    const response = await fetcher(`${url}&recovery=${Date.now()}`, {
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sf-map-svg-election-check' },
    });
    if (!response.ok) throw metadataFailure(response, request);
    return response.json();
  }
  // Include failed/cancelled overall runs: a deploy job could have succeeded
  // before a later cleanup failed. Skip only runs that did not publish Pages.
  const runs = await read(
    `${api}/workflows/pages.yml/runs?status=completed&per_page=20`,
    'workflow-list',
  );
  if (!Array.isArray(runs.workflow_runs)) throw new Error('Invalid workflow metadata');
  if (
    previousRunNumber !== null &&
    (!Number.isSafeInteger(previousRunNumber) ||
      !runs.workflow_runs.some((run) => run.run_number === previousRunNumber))
  )
    throw new Error('Deployment metadata has not reached the preceding workflow run');
  runs.workflow_runs.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  for (const run of runs.workflow_runs) {
    if (
      !Number.isSafeInteger(run.id) ||
      !/^[a-f0-9]{40}$/.test(run.head_sha) ||
      !Number.isFinite(Date.parse(run.created_at)) ||
      !Number.isFinite(Date.parse(run.updated_at))
    )
      throw new Error('Invalid deployment identity');
    const jobs = await read(`${api}/runs/${run.id}/jobs?per_page=100`, 'run-jobs');
    if (
      !Array.isArray(jobs.jobs) ||
      !Number.isSafeInteger(jobs.total_count) ||
      jobs.total_count !== jobs.jobs.length ||
      jobs.jobs.some((job) => job.status !== 'completed')
    )
      throw new Error('Incomplete deployment jobs');
    const deploy = jobs.jobs.find((job) => job.name === 'deploy' && job.conclusion === 'success');
    if (deploy) {
      if (!Number.isFinite(Date.parse(deploy.completed_at)))
        throw new Error('Invalid deployment completion');
      const build = jobs.jobs.find((job) => job.name === 'build' && job.conclusion === 'success');
      if (!build || !Number.isFinite(Date.parse(build.started_at)))
        throw new Error('Cannot verify deployed build start');
      return {
        startedAt: build.started_at,
        id: run.id,
        headSha: run.head_sha,
        createdAt: run.created_at,
        completedAt: deploy.completed_at,
      };
    }
  }
  throw new Error('No verified prior Pages deployment in recent runs');
}
export function verifyDeploymentSnapshot(snapshot, deployment) {
  const checked = Date.parse(snapshot.checkedAt);
  const generated = Date.parse(snapshot.generatedAt);
  const started = Date.parse(deployment.startedAt);
  const completed = Date.parse(deployment.completedAt);
  if (
    snapshot.buildCommit !== deployment.headSha ||
    !Number.isFinite(checked) ||
    !Number.isFinite(generated) ||
    !Number.isFinite(started) ||
    !Number.isFinite(completed) ||
    checked < started ||
    generated < checked ||
    generated > completed
  )
    throw new Error(
      `CDN snapshot does not match latest Pages deployment ${deployment.id}; refusing history rollback`,
    );
  return snapshot;
}
export async function loadPreviousSnapshot(
  seed,
  fetcher = fetch,
  deploymentReader = latestSuccessfulDeployment,
) {
  try {
    const deployment = await deploymentReader(fetcher, {
      previousRunNumber:
        process.env.ELECTION_PROBE !== 'true' && process.env.GITHUB_RUN_NUMBER
          ? Number(process.env.GITHUB_RUN_NUMBER) - 1
          : null,
    });
    const response = await fetcher(
      `https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json?recovery=${Date.now()}`,
      { signal: AbortSignal.timeout(20_000), cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const deployed = verifyDeploymentSnapshot(validateSnapshot(await response.json()), deployment);
    return chooseSnapshotSeed(seed, deployed);
  } catch (cause) {
    // Public run metadata is independent of the Pages CDN. Fail closed on a
    // stale edge response, unavailable metadata, or lost history; no reset seed.
    throw new Error(
      'Cannot safely recover deployed election results/history; refusing publication',
      { cause },
    );
  }
}
