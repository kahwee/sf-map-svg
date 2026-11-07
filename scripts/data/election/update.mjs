import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validateSnapshot } from '../../../website/election/model.js';
import { needsElectionDeployment } from './changes.mjs';
import { loadPreviousSnapshot } from './previous-deployment.mjs';

import {
  markSosFailure,
  parseSosCounty,
  retainLastGood,
  sosIndexUrl,
  sosMappings,
  sosUrl,
} from './sos-county-results.mjs';

const output = process.argv[2] || 'pages-dist/elections/2026-11-03.json';
const seed = validateSnapshot(JSON.parse(await readFile('elections/2026-11-03.json', 'utf8')));
const previous = await loadPreviousSnapshot(seed);
const now = new Date().toISOString();
let next = {
  ...previous,
  checkedAt: now,
  generatedAt: now,
  buildCommit: process.env.GITHUB_SHA || null,
};
// Local SF results come from the department's CVR exports (data/elections), reconciled with its
// summary reports. Only the California SOS county reports are checked here.
next.sourceChecks = [];
try {
  async function download(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!response.ok) throw new Error(`SOS HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 10_000_000) throw new Error('SOS file too large');
    return text;
  }
  const index = await download(sosIndexUrl);
  if (!index.includes('California November 3, 2026 Statewide General Election'))
    throw new Error('SOS index changed election');
  const files = [...new Set(sosMappings.map(sosUrl))];
  const reports = await Promise.allSettled(
    files.map(async (url) => ({ url, rows: JSON.parse(await download(url)) })),
  );
  const loaded = new Map(
    reports.filter((r) => r.status === 'fulfilled').map((r) => [r.value.url, r.value.rows]),
  );
  let verified = 0;
  const errors = [];
  for (const mapping of sosMappings) {
    const position = next.contests.findIndex((c) => c.id === mapping.id);
    const contest = next.contests[position];
    try {
      const incoming = parseSosCounty(loaded.get(sosUrl(mapping)), mapping, contest, index);
      const retained = retainLastGood(contest, incoming);
      next.contests[position] = {
        ...retained,
        resultCheckStatus: retained === contest ? 'stale' : 'ok',
        resultCheckedAt: new Date().toISOString(),
      };
      verified++;
    } catch (error) {
      errors.push(`${mapping.id}: ${error.message}`);
      if (contest)
        next.contests[position] = {
          ...contest,
          resultCheckStatus: 'error',
          resultCheckedAt: new Date().toISOString(),
        };
    }
  }
  const fetchedAt = new Date().toISOString();
  next.sourceChecks.push({
    id: 'ca-sos',
    sourceUrl: sosIndexUrl,
    status: verified === sosMappings.length ? 'ok' : 'error',
    checkedAt: now,
    verifiedContests: verified,
    errors,
  });
  if (verified) {
    next.checkStatus = verified === sosMappings.length ? 'ok' : 'partial';
    next.lastSuccessfulFetchAt = fetchedAt;
    next.message = `Verified SOS county reports for ${verified} state/federal and judicial contests. Zero/pre-election reports remain pending. All counts are SF county portions; all contests remain uncalled.`;
  }
} catch (error) {
  next = markSosFailure(next, new Date().toISOString());
  next.sourceChecks.push({
    id: 'ca-sos',
    sourceUrl: sosIndexUrl,
    status: 'error',
    checkedAt: now,
    message: error.message,
  });
}
next.status = next.contests.some((c) => c.options.some((o) => o.votes !== null))
  ? 'unofficial'
  : 'pending';
next.generatedAt = new Date().toISOString();
validateSnapshot(next);
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
await rename(`${output}.tmp`, output);
console.log(`Election check: ${next.checkStatus}; results: ${next.status}; ${now}`);

if (process.env.ELECTION_PROBE === 'true' && process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `changed=${needsElectionDeployment(previous, next)}\n`,
  );
