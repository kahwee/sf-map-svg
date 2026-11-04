import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseOfficialReport, validateSnapshot } from '../website/election-model.js';

const output = process.argv[2] || 'pages-dist/elections/2026-11-03.json';
const seed = validateSnapshot(JSON.parse(await readFile('elections/2026-11-03.json', 'utf8')));
let previous = seed;
// The deployed feed is the last-good store; no polling commits or npm releases.
try {
  const response = await fetch('https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json', {
    signal: AbortSignal.timeout(20_000),
  });
  if (response.ok) previous = validateSnapshot(await response.json());
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
validateSnapshot(next);
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
await rename(`${output}.tmp`, output);
console.log(`Election check: ${next.checkStatus}; results: ${next.status}; ${now}`);
