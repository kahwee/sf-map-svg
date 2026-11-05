import { chromium } from 'playwright';
import { checkArtifacts } from './pages/artifacts.mjs';
import { checkElection } from './pages/election.mjs';
import { checkElectionLifecycle } from './pages/election-lifecycle.mjs';
import { checkPopoverViewport } from './pages/election-popovers.mjs';
import { visit } from './pages/layout.mjs';
import { checkPlayground } from './pages/playground.mjs';
import { servePages } from './pages/server.mjs';
import { checkStudioLoading } from './pages/studio.mjs';

const root = 'pages-dist';
const base = '/sf-map-svg/';
const pages = [
  '',
  'election.html',
  'precincts.html',
  'layers.html',
  'playground.html',
  'examples.html',
  'measures.html',
  'propositions.html',
  'candidates.html',
  'spot.html',
  'transit.html',
  'docs.html',
  'api.html',
];

const problems = [];
const fail = (message) => problems.push(message);
async function scenario(name, run) {
  console.log(`Pages: ${name}`);
  try {
    await run();
  } catch (error) {
    fail(`${name}: ${error.stack}`);
  }
}
await scenario('asset budgets and documentation', () => checkArtifacts(root, fail));
const server = await servePages(root, base);
let browser;
try {
  browser = await chromium.launch();
  const harness = { browser, origin: server.origin, base, fail };
  for (const [name, check] of [
    ['election navigation and results', checkElection],
    ['election refresh lifecycle', checkElectionLifecycle],
    ['election popover viewport', checkPopoverViewport],
    ['studio loading and recovery', checkStudioLoading],
    ['playground controls and export', checkPlayground],
  ])
    await scenario(name, () => check(harness));
  for (const path of pages) {
    await scenario(`${path || 'index'} desktop light`, () =>
      visit(harness, path, { width: 1440, height: 900, colorScheme: 'light' }),
    );
    await scenario(`${path || 'index'} phone dark`, () =>
      visit(harness, path, { width: 390, height: 844, colorScheme: 'dark' }),
    );
  }
  await scenario('deep-link 404', () =>
    visit(harness, 'missing/deep/page', {
      width: 390,
      height: 844,
      colorScheme: 'light',
      expectStatus: 404,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
if (problems.length) {
  console.error(`Pages check found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else
  console.log(
    `Pages check passed: ${pages.length} pages at 1440 px light and 390 px dark, plus 404.`,
  );
