import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  chooseSnapshotSeed,
  parseOfficialReport,
  validateSnapshot,
} from '../website/election-model.js';

import {
  parseSosCounty,
  retainLastGood,
  sosIndexUrl,
  sosMappings,
  sosUrl,
} from './lib/sos-county-results.mjs';

const output = process.argv[2] || 'pages-dist/elections/2026-11-03.json';
const seed = validateSnapshot(JSON.parse(await readFile('elections/2026-11-03.json', 'utf8')));
let previous = seed;
// The deployed feed is the last-good store; no polling commits or npm releases.
try {
  const response = await fetch('https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json', {
    signal: AbortSignal.timeout(20_000),
  });
  if (response.ok) {
    const deployed = validateSnapshot(await response.json());
    // A pending deployed ballot must not overwrite newly verified roster corrections.
    previous = chooseSnapshotSeed(seed, deployed);
  }
} catch {
  console.warn('Previous feed unavailable; retaining the checked-in verified ballot.');
}
const now = new Date().toISOString();
let next = {
  ...previous,
  checkedAt: now,
  generatedAt: now,
  buildCommit: process.env.GITHUB_SHA || null,
};
try {
  const response = await fetch(seed.sourceUrl, {
    signal: AbortSignal.timeout(25_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Official source HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > 10_000_000) throw new Error('Official report too large');
  next = { ...next, ...parseOfficialReport(html), checkStatus: 'ok', lastSuccessfulFetchAt: now };
} catch (error) {
  next.checkStatus = 'error';
  next.message = `${error.message}. Vote totals retained only from a previously validated snapshot; missing totals are unknown, not zero.`;
  console.warn(next.message);
}
next.sourceChecks = [
  {
    id: 'sf-local',
    sourceUrl: seed.sourceUrl,
    status: next.checkStatus,
    checkedAt: now,
    message: next.message,
  },
];
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
    next.checkStatus = 'partial';
    next.lastSuccessfulFetchAt = fetchedAt;
    next.message = `Verified SOS county reports for ${verified} state/federal and judicial contests. Zero/pre-election reports remain pending. Local SF and district/precinct results are unavailable. All counts are SF county portions; all contests remain uncalled.`;
  }
} catch (error) {
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
