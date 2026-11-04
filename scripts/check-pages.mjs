// Browser smoke test for the built Pages site (run after `pnpm build:pages`).
// Serves pages-dist under the production base path and checks every page for
// script errors, failed requests, horizontal overflow, and layout shift, plus
// compressed size budgets. Fails with a list of problems.
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const root = 'pages-dist';
const base = '/sf-map-svg/';
const pages = [
  '',
  'election.html',
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
// Initial JavaScript and CSS, gzip KB. Transit embeds the library's animation with its geometry.
const budgets = {
  index: 45.9, // Shared label preparation; static font estimation stays out (45.7 KB measured).
  layers: 48.7, // Includes opt-in static overview label layout (48.5 KB measured).
  playground: 54.4, // V5 tuple coordinates and explicit reset API (54.22 KiB measured).
  // TanStack Charts 1.2.1 adds typed scales, axes and accessible SVG (37.78 KB measured).
  election: 40,
  examples: 12,
  measures: 25,
  propositions: 25,
  candidates: 25,
  spot: 15,
  transit: 480,
  docs: 12.5, // Readable stacked reference records on phones.
  api: 12.5,
  404: 12,
};
// Pre-rendered maps and datasets, gzip KB. Full geography loads only when exporting.
const mapBudgets = { 'maps/display': 20, 'maps/thumb': 30, 'maps/figures': 30, 'maps/plates': 60 };
const dataBudgets = { 'data/site-map.json': 320, 'data/export-map.json': 2048 };
// Media is already compressed; enforce raw KiB limits separately from JS/CSS gzip budgets.
const mediaBudgets = {
  'media/markers-2000-desktop.webp': 110,
  'media/markers-2000-phone.webp': 50,
  'media/markers-2000-desktop.webm': 1250,
  'media/markers-2000-phone.webm': 520,
};
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

const problems = [];
const fail = (message) => problems.push(message);

// ---------- Size budgets ----------
const gzipKb = async (path) => gzipSync(await readFile(join(root, path))).length / 1024;
for (const [name, limit] of Object.entries(budgets)) {
  const html = await readFile(join(root, `${name}.html`), 'utf8');
  let total = 0;
  for (const [, path] of html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css))"/g))
    total += await gzipKb(path);
  if (total > limit)
    fail(`${name}.html loads ${total.toFixed(2)} KB gzip JS/CSS (budget ${limit} KB)`);
}
for (const [folder, limit] of Object.entries(mapBudgets)) {
  const files = (await readdir(join(root, folder))).filter((name) => name.endsWith('.svg'));
  if (!files.length) fail(`${folder} has no maps`);
  for (const name of files) {
    const size = await gzipKb(`${folder}/${name}`);
    if (size > limit) fail(`${folder}/${name} is ${size.toFixed(1)} KB gzip (budget ${limit} KB)`);
  }
}
for (const [path, limit] of Object.entries(dataBudgets)) {
  const size = await gzipKb(path);
  if (size > limit) fail(`${path} is ${size.toFixed(1)} KB gzip (budget ${limit} KB)`);
}
for (const [path, limit] of Object.entries(mediaBudgets)) {
  const size = (await stat(join(root, path))).size / 1024;
  if (size > limit) fail(`${path} is ${size.toFixed(1)} KiB (budget ${limit} KiB)`);
}

// Assistant-readable docs must match this build and every index link must resolve locally.
const release = JSON.parse(await readFile(join(root, 'release.json'), 'utf8'));
const llms = await readFile(join(root, 'llms.txt'), 'utf8');
const fullDocs = await readFile(join(root, 'llms-full.txt'), 'utf8');
const apiHtml = await readFile(join(root, 'api.html'), 'utf8');
if (apiHtml.includes('Preview features') || apiHtml.includes('selected npm package'))
  fail('API reference exposes internal preview warnings');
if (
  !apiHtml.includes(`This reference describes <code>@kahwee/sf-map-svg ${release.version}</code>`)
)
  fail('API reference does not identify the documented package version');
for (const [name, content] of [
  ['llms.txt', llms],
  ['llms-full.txt', fullDocs],
]) {
  if (!content.includes(`@kahwee/sf-map-svg ${release.version} ·`))
    fail(`${name} does not match the site's package version`);
  if (!content.includes(release.source === 'npm' ? 'npm package' : 'local working tree'))
    fail(`${name} does not match the site's package source`);
}
for (const [, path] of llms.matchAll(/\]\(https:\/\/kahwee\.github\.io\/sf-map-svg\/([^)]+)\)/g)) {
  if (!(await stat(join(root, path)).catch(() => null))?.isFile())
    fail(`llms.txt links to missing ${path}`);
}

// ---------- Static server under the production base path ----------
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
  if (path === '') path = 'index.html';
  const file = path === null ? null : normalize(join(root, decodeURIComponent(path)));
  const found = file?.startsWith(root) && (await stat(file).catch(() => null))?.isFile();
  if (!found) {
    response.writeHead(404, { 'content-type': 'text/html' });
    createReadStream(join(root, '404.html')).pipe(response);
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- Browser checks ----------
const browser = await chromium.launch();
async function visit(path, { width, height, colorScheme, expectStatus = 200 }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  const page = await context.newPage();
  const label = `${path || 'index'} @${width} ${colorScheme}`;
  page.on('pageerror', (error) => fail(`${label}: ${error.message}`));
  page.on('console', (message) => {
    // Failed requests are reported precisely by the response listener below.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
      fail(`${label}: console error: ${message.text()}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(origin) && response.status() >= 400 && url !== `${origin}${base}${path}`)
      fail(`${label}: ${response.status()} for ${url.slice(origin.length)}`);
  });
  const response = await page.goto(`${origin}${base}${path}`, { waitUntil: 'load' });
  if (response.status() !== expectStatus)
    fail(`${label}: expected HTTP ${expectStatus}, got ${response.status()}`);
  await page.waitForTimeout(2500);
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) shift += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(
          () =>
            resolve({
              shift,
              title: document.title,
              generatedSocialTitle: document.querySelector('meta[data-generated-social]')?.content,
              overflow: document.documentElement.scrollWidth - innerWidth,
              toggle: Boolean(
                document.querySelector('.theme-toggle')?.getBoundingClientRect().width,
              ),
            }),
          200,
        );
      }),
  );
  if (result.generatedSocialTitle && result.generatedSocialTitle !== result.title)
    fail(`${label}: generated social title differs from the page title`);
  if (result.overflow > 0) fail(`${label}: page scrolls sideways by ${result.overflow}px`);
  if (result.shift > 0.01) fail(`${label}: layout shift ${result.shift.toFixed(4)}`);
  if (!result.toggle) fail(`${label}: theme toggle is not visible`);
  if (path === 'examples.html') {
    try {
      const videos = page.locator('#marker-recordings video');
      if ((await videos.count()) !== 2) throw new Error('Expected desktop and phone recordings');
      const eagerVideo = await page.evaluate(() =>
        performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('.webm')),
      );
      if (eagerVideo) fail(`${label}: recording downloaded before playback`);
      for (const video of await videos.all()) {
        await video.evaluate(async (node) => {
          node.muted = true;
          node.textTracks[0].mode = 'hidden';
          await node.play();
          node.pause();
        });
      }
      await page.waitForFunction(() =>
        [...document.querySelectorAll('#marker-recordings video')].every(
          (video) =>
            video.readyState >= 2 &&
            video.videoWidth === Number(video.getAttribute('width')) &&
            video.videoHeight === Number(video.getAttribute('height')) &&
            video.textTracks[0]?.cues?.length > 0,
        ),
      );
    } catch (error) {
      fail(`${label}: recording playback/captions: ${error.message}`);
    }
  }
  await context.close();
}

async function checkStudioLoading() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => fail(`studio loading: ${error.message}`));
  let releaseData;
  const pending = new Promise((resolve) => {
    releaseData = resolve;
  });
  await page.route('**/data/site-map.json', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto(`${origin}${base}layers.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#render-control button'));
    const disabled = await page.evaluate(() =>
      [
        ...document.querySelectorAll('#studio-controls input, #studio-controls button, #download'),
      ].every((control) => control.matches(':disabled')),
    );
    if (!disabled) fail('studio loading: map controls are enabled before geography arrives');
    releaseData();
    await page.waitForSelector('#studio-map svg');
    if (await page.locator('#download').isDisabled())
      fail('studio loading: download stays disabled after successful load');
    await page.getByRole('button', { name: 'Static SVG', exact: true }).click();
    if (
      !(await page.getByRole('checkbox', { name: 'Neighborhood names', exact: true }).isDisabled())
    )
      fail('studio static: unsupported neighborhood-name control stays enabled');
    await page.unroute('**/data/site-map.json');
    await page.route('**/data/site-map.json', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('status').filter({ hasText: 'The map could not load.' }).waitFor();
    if (!(await page.locator('#download').isDisabled()))
      fail('studio failure: download is enabled');
    await page.getByRole('button', { name: 'Interactive', exact: true }).click();
    await page.getByRole('button', { name: 'Static SVG', exact: true }).click();
    if (!(await page.locator('#studio-map').innerText()).includes('The map could not load.'))
      fail('studio failure: render selection removed the error state');
  } finally {
    releaseData();
    await context.close();
  }
}

async function checkPlayground() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    permissions: ['clipboard-read', 'clipboard-write'],
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => fail(`playground: ${error.message}`));
  let releaseData;
  const pending = new Promise((resolve) => {
    releaseData = resolve;
  });
  await page.route('**/data/site-map.json', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto(`${origin}${base}playground.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.palette-card');
    const gated = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '#design-controls input, #design-controls button, #design-controls select, #design-download, #design-copy, #preview-static',
        ),
      ].every((control) => control.matches(':disabled')),
    );
    if (!gated) fail('playground: controls are active before data loads');
    releaseData();
    await page.waitForSelector('#design-map svg');
    await page.getByRole('button', { name: 'District 3, 2022', exact: true }).press('Enter');
    const retained = await page.locator('#design-map .sf-explorer').elementHandle();
    const viewport = await page.locator('#design-map svg').getAttribute('viewBox');
    await page
      .getByRole('button', { name: 'Blueprint: A city drawn in midnight ink.', exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector('#design-map svg rect')?.getAttribute('fill') === '#142d45',
    );
    if (
      (await page.locator('#design-map').getAttribute('data-update-strategy')) === 'configure' &&
      !(await retained.evaluate(
        (node) => node === document.querySelector('#design-map .sf-explorer'),
      ))
    )
      fail('playground: styling reconstructed the controller');
    if (
      (await page.locator('#design-map .sf-explorer').getAttribute('data-selected-district')) !==
      '3'
    )
      fail('playground: styling lost district selection');
    if ((await page.locator('#design-map svg').getAttribute('viewBox')) !== viewport)
      fail('playground: styling lost camera state');
    // Live attributes update in the animation frame; assert the final painted color too.
    await page.waitForFunction(() => {
      const water = document.querySelector('#design-map svg rect');
      return water && getComputedStyle(water).fill === 'rgb(20, 45, 69)';
    });
    await page.getByRole('button', { name: 'Undo design change', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('#design-map svg rect')?.getAttribute('fill') === '#e7f0f3',
    );
    await page.getByRole('button', { name: 'Redo design change', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('#design-map svg rect')?.getAttribute('fill') === '#142d45',
    );
    await page.getByRole('button', { name: 'Static SVG', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#design-map .sf-explorer'));
    if (!(await page.locator('#option-neighborhoodLabels').isDisabled()))
      fail('playground: static preview enables browser-only layers');
    await page.getByRole('button', { name: 'Browser map', exact: true }).click();
    await page.waitForFunction(
      (view) => document.querySelector('#design-map svg')?.getAttribute('viewBox') === view,
      viewport,
    );
    if (
      (await page.locator('#design-map .sf-explorer').getAttribute('data-selected-district')) !==
      '3'
    )
      fail('playground: returning from static preview lost district selection');
    await page.getByRole('button', { name: 'Static SVG', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#design-map .sf-explorer'));
    await page.locator('#design-mode').selectOption('neighborhoods');
    await page.locator('#design-source').selectOption('analysis');
    await page.waitForFunction(() =>
      document
        .querySelector('#design-code')
        .textContent.includes('neighborhoodCollections["analysis"]'),
    );
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export city SVG', exact: true }).click(),
    ]);
    const svg = await readFile(await download.path(), 'utf8');
    if (!svg.includes('fill="#142d45"') || !svg.includes('data-neighborhood='))
      fail('playground: SVG export does not match the chosen palette/source');
    if (/<script|https?:\/\/[^" ]+\.js/.test(svg)) fail('playground: export is not self-contained');
    await page.getByRole('button', { name: 'Copy code', exact: true }).click();
    const copiedCode = await page.evaluate(() => navigator.clipboard.readText());
    if (
      !copiedCode.includes('renderMap') ||
      !copiedCode.includes('#142d45') ||
      !copiedCode.includes('analysis')
    )
      fail('playground: copied code does not match the design');
    await page.getByRole('button', { name: 'Copy design link', exact: true }).click();
    const designUrl = await page.evaluate(() => navigator.clipboard.readText());
    await page.getByRole('button', { name: 'Copy design link', exact: true }).waitFor();
    await page.goto('about:blank');
    await page.goto(designUrl, { waitUntil: 'load' });
    await page.waitForSelector('#design-map svg');
    if (
      (await page.locator('#design-source').inputValue()) !== 'analysis' ||
      (await page.locator('#design-map svg rect').getAttribute('fill')) !== '#142d45'
    )
      fail('playground: design link did not restore settings');
    await page.route('**/data/export-map.json', (route) => route.abort());
    await page.getByRole('button', { name: 'Export city SVG', exact: true }).click();
    await page
      .getByText('Export could not load its geography. Try exporting again.', { exact: true })
      .waitFor();
    if (await page.locator('#design-download').isDisabled())
      fail('playground: failed export cannot be retried');
    await page.unroute('**/data/export-map.json');
    await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export city SVG', exact: true }).click(),
    ]);
    // Both native pickers must remain legible and controls reachable on a short phone.
    await page.setViewportSize({ width: 390, height: 600 });
    await page.getByRole('button', { name: 'Browser map', exact: true }).click();
    await page
      .locator('details')
      .filter({ has: page.locator('#design-pins') })
      .evaluate((node) => {
        node.open = true;
      });
    await page.locator('#design-pins').check();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('#design-map .sf-explorer-feature-controls select').length === 2,
    );
    await page.locator('#design-source').focus();
    const accessible = await page.locator('#design-source').evaluate((node) => {
      node.scrollIntoView({ block: 'center' });
      const rect = node.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === node;
    });
    if (!accessible) fail('playground: short-phone preview obscures the focused source control');
    const contrast = await page
      .locator('#design-map .sf-explorer-feature-controls label')
      .first()
      .evaluate((node) => {
        const channels = (value) =>
          value
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const n = v / 255;
              return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
            });
        const luminance = (value) => {
          const [r, g, b] = channels(value);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const a = luminance(getComputedStyle(node).color);
        const b = luminance(
          getComputedStyle(node.closest('.sf-explorer-feature-controls')).backgroundColor,
        );
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    if (contrast < 4.5) fail(`playground: dark picker label contrast is ${contrast.toFixed(2)}:1`);
    await page.locator('#design-language').selectOption('typescript');
    if (!(await page.locator('#design-code').innerText()).includes('const options: MapOptions'))
      fail('playground: TypeScript selection does not generate typed options');
    await page.unroute('**/data/site-map.json');
    await page.route('**/data/site-map.json', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reload playground', exact: true }).waitFor();
    if (!(await page.locator('#design-download').isDisabled()))
      fail('playground: failed data load enables export');
  } catch (error) {
    fail(`playground interaction: ${error.stack}`);
  } finally {
    releaseData();
    await context.close();
  }
}

async function checkElection() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}${base}election.html`);
    await page.locator('#contests article').first().waitFor();
    if ((await page.locator('#contests article').count()) !== 1)
      fail('election: more than one active contest');
    if ((await page.locator('main details').count()) !== 0)
      fail('election: content hidden behind disclosures');
    if (!(await page.locator('.contest-details a').first().isVisible()))
      fail('election: official source hidden');
    const votes = await page.locator('.vote-list').boundingBox();
    if (!votes || votes.y + votes.height > 844)
      fail('election: phone Yes/No rows are below the first screen');
    const measureIds = await page
      .locator('#contest-select option')
      .evaluateAll((options) => options.map((o) => o.value));
    for (const id of measureIds) {
      await page.locator('#contest-select').selectOption(id);
      const rows = await page.locator('.vote-list').boundingBox();
      if (!rows || rows.y + rows.height > 844)
        fail(`election: ${id} phone vote rows require scrolling`);
    }
    await page.locator('#contest-select').selectOption('local-A');
    await page.locator('#contest-select').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    if (!(await page.locator('#contests h2').textContent()).includes('city-owned bank'))
      fail('election: keyboard contest switch failed');
    await page.locator('#contest-select').selectOption('local-G');
    if (!(await page.locator('.contest-summary').textContent()).includes('Monday'))
      fail('election: summary did not change');
    const historyPosition = await page.locator('.batch-history').boundingBox();
    const explanationPosition = await page.locator('.contest-explanation').boundingBox();
    if (!historyPosition || !explanationPosition || historyPosition.y >= explanationPosition.y)
      fail('election: explanation precedes the results visualization on phone');
    if (!(await page.locator('[data-media-projection]').textContent()).includes('Not certified'))
      fail('election: media projection lacks certification distinction');
    if (
      !(await page.locator('[data-media-tally]').textContent()).includes('KQED preliminary tally')
    )
      fail('election: media tally lacks attribution');
    if (
      !(await page.locator('.vote-list').textContent()).includes('62.8%') ||
      (await page.locator('.vote-share').count()) !== 2
    )
      fail('election: count-derived shares missing');
    if (!(await page.locator('.vote-list').textContent()).includes('109,319'))
      fail('election: verified media tally missing');
    if (
      !(await page.locator('.batch-history h3').textContent()).includes('Newsroom observations') ||
      (await page.locator('.trend-panel svg circle').count()) !== 8
    )
      fail('election: separate newsroom history missing');
    if (await page.locator('.history-table-wrap').isVisible())
      fail('election: history table should be hidden in default Chart view');
    if ((await page.locator('.trend-panel .ts-chart__grid line').count()) < 4)
      fail('election: chart guide lines missing');
    await page.getByRole('button', { name: 'Table', exact: true }).focus();
    await page.keyboard.press('Enter');
    if (
      !(await page.locator('.history-table-wrap').isVisible()) ||
      (await page.locator('.trend-panel svg').isVisible())
    )
      fail('election: keyboard Table toggle did not switch views');
    if (!(await page.locator('.trend-selected-source').isVisible()))
      fail('election: view toggle hid source provenance');
    await page.getByRole('button', { name: 'Chart', exact: true }).click();
    if (!(await page.locator('.trend-panel svg').isVisible()))
      fail('election: Chart toggle did not restore chart');
    for (const count of ['64,656', '57,242', '54,391', '109,319']) {
      if (!(await page.locator('.history-table-wrap').textContent()).includes(count))
        fail('election: comparison table lost a real observation');
    }
    if (await page.getByRole('button', { name: '← Previous', exact: true }).count())
      fail('election: redundant previous navigation remains');
    if (await page.getByLabel('View option', { exact: true }).count())
      fail('election: measure comparison requires option selection');
    if (
      !(await page.locator('.history-table-wrap').textContent()).includes('Publisher page updated')
    )
      fail('election: media timestamps mislabeled as official reports');
    await page.locator('#contest-select').selectOption('RTM');
    if (
      !(await page.locator('.contest-meta').textContent()).includes('Five-county RTM region') ||
      !(await page.locator('#contests').textContent()).includes('Santa Clara')
    )
      fail('election: RTM full-region scope missing');
    if (
      !(await page.locator('.vote-list').textContent()).includes('690,335') ||
      !(await page.locator('[data-media-projection]').textContent()).includes(
        'passed. Not certified',
      )
    )
      fail('election: RTM attributed tally/projection missing');
    if ((await page.locator('.trend-panel svg circle').count()) !== 6)
      fail('election: RTM observations missing');
    for (const count of ['671,876', '650,366', '431,242']) {
      if (!(await page.locator('.history-table-wrap').textContent()).includes(count))
        fail('election: RTM comparison lost prior observations');
    }
    await page.locator('#ballot-search').fill('zzzz-no-match');
    if (!(await page.locator('#contests').textContent()).includes('No matching'))
      fail('election: no-match state failed');
    await page.locator('#ballot-search').fill('');
    await page.locator('#contest-kind').selectOption('candidate');
    await page.locator('#region').selectOption('8');
    await page.locator('#ballot-search').fill('supervisor');
    const cards = page.locator('#contests article');
    if ((await cards.count()) !== 1 || !(await cards.textContent()).includes('District 8'))
      fail('election: district ballot filter failed');
    await page.route('**/elections/2026-11-03.json', (route) => route.abort());
    await page.locator('#refresh').click();
    await page.waitForFunction(() =>
      document.querySelector('#check-status').textContent.includes('Feed unavailable'),
    );
    if ((await cards.count()) !== 1) fail('election: failed refresh removed last-good display');
    await page.unroute('**/elections/2026-11-03.json');
    const stale = JSON.parse(await readFile('elections/2026-11-03.json', 'utf8'));
    stale.checkedAt = '2026-11-03T00:00:00Z';
    stale.checkStatus = 'error';
    await page.route('**/elections/2026-11-03.json', (route) => route.fulfill({ json: stale }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.querySelector('#check-status').textContent.includes('Stale check'),
    );
    if (!(await page.locator('#report-time').textContent()).includes('not yet verified'))
      fail('election: stale fetch synthesized report time');
    await page.unroute('**/elections/2026-11-03.json');
    const historyData = structuredClone(stale);
    historyData.status = 'unofficial';
    historyData.checkStatus = 'partial';
    historyData.lastSuccessfulFetchAt = '2026-11-04T04:04:00Z';
    const candidate = historyData.contests.find((c) => c.id === 'state-1');
    Object.assign(candidate, {
      resultStatus: 'unofficial',
      resultSourceUrl: 'https://media.sos.ca.gov/media/ballot-measures.json',
      sourceReportTime: 'November 3, 2026, 8:01 p.m.',
      resultsFetchedAt: '2026-11-04T04:02:00Z',
      reporting: '0% (0 of 514) precincts reporting',
      resultGeography: {
        type: 'county',
        id: '06075',
        name: 'San Francisco',
        scope: 'county-portion-of-contest',
      },
    });
    candidate.options[0].votes = 123;
    candidate.options[1].votes = 77;
    const point = () => ({
      sourceReportTime: candidate.sourceReportTime,
      observedAt: candidate.resultsFetchedAt,
      resultSourceUrl: candidate.resultSourceUrl,
      reporting: candidate.reporting,
      resultGeography: structuredClone(candidate.resultGeography),
      options: structuredClone(candidate.options),
    });
    candidate.resultHistory = [point()];
    await page.route('**/elections/2026-11-03.json', (route) =>
      route.fulfill({ json: historyData }),
    );
    await page.locator('#refresh').click();
    await page.locator('#ballot-search').fill('');
    await page.locator('#contest-kind').selectOption('measure');
    await page.locator('#contest-select').selectOption('state-1');
    if (!(await page.locator('.trend-value').textContent()).includes('One batch; no trend yet'))
      fail('election: single report invented a trend');
    if ((await page.locator('.batch-history svg path').count()) !== 0)
      fail('election: single report drew a connecting trend');
    candidate.sourceReportTime = 'November 3, 2026, 8:03 p.m.';
    candidate.resultsFetchedAt = '2026-11-04T04:04:00Z';
    candidate.options[0].votes = 140;
    candidate.options[1].votes = 110;
    candidate.resultHistory.push(point());
    await page.locator('#refresh').click();
    await page.waitForFunction(
      () => document.querySelectorAll('.history-table-wrap tbody tr').length === 2,
    );
    if ((await page.locator('.trend-panel svg circle').count()) !== 4)
      fail('election: both official series must display both actual reports');
    await page.getByLabel('Measure', { exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    if (!(await page.locator('.trend-value').textContent()).includes('No: 44.0%'))
      fail('election: chart comparison metric selection failed');
    if (!(await page.locator('.history-table-wrap').textContent()).includes('8:03 p.m.'))
      fail('election: exact report time absent from accessible table');
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await page.locator('.history-table-wrap').focus();
    if (
      !(await page
        .locator('.history-table-wrap')
        .evaluate((node) => node === document.activeElement))
    )
      fail('election: history table cannot receive keyboard focus');
    if ((await page.locator('main details').count()) !== 0)
      fail('election: history hidden in disclosure');
  } catch (error) {
    fail(`election interaction: ${error.stack}`);
  } finally {
    await context.close();
  }
}

async function checkElectionLifecycle() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const data = JSON.parse(await readFile('elections/2026-11-03.json', 'utf8'));
  data.checkedAt = '2026-11-04T06:30:00Z';
  try {
    await page.clock.install({ time: new Date('2026-11-04T06:30:00Z') });
    await page.route('**/elections/2026-11-03.json', async (route) => {
      requests++;
      const response = structuredClone(data);
      if (requests === 2) {
        await held;
        response.checkedAt = '2026-11-04T06:40:00Z';
      }
      if (requests >= 3) {
        response.checkedAt = '2026-11-04T06:20:00Z';
        response.contests.find((c) => c.id === 'local-G').shortTitle = 'Older cached title';
      }
      await route.fulfill({ json: response });
    });
    await page.goto(`${origin}${base}election.html?contest=local-G`);
    await page.locator('#contests article').waitFor();
    await page.locator('select[aria-label="Measure"]').selectOption('share');
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await page.evaluate(() =>
      Object.defineProperty(document, 'hidden', { configurable: true, value: true }),
    );
    await page.clock.fastForward(10 * 60_000);
    if (requests !== 1) fail('election lifecycle: hidden timer fetched');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.getElementById('refresh').disabled);
    await page.evaluate(() => {
      document.getElementById('refresh').dispatchEvent(new Event('click'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    if (requests > 2) fail('election lifecycle: overlapping fetches');
    release();
    await page.waitForFunction(() => !document.getElementById('refresh').disabled);
    if (requests !== 2) fail('election lifecycle: due visibility refresh missing');
    if (
      (await page
        .getByRole('button', { name: 'Table', exact: true })
        .getAttribute('aria-pressed')) !== 'true' ||
      !(await page.locator('.history-table-wrap').isVisible())
    )
      fail('election lifecycle: refresh reset Table view');
    if ((await page.locator('select[aria-label="Measure"]').inputValue()) !== 'share')
      fail('election lifecycle: automatic refresh reset chart selection');
    await page.locator('#refresh').click();
    await page.waitForFunction(() =>
      document.getElementById('check-status').textContent.includes('Feed unavailable'),
    );
    if ((await page.locator('#contests h2').textContent()).includes('Older cached title'))
      fail('election lifecycle: older snapshot replaced newer data');
    if ((await page.locator('select[aria-label="Measure"]').inputValue()) !== 'share')
      fail('election lifecycle: rejected response reset metric');
  } catch (error) {
    fail(`election lifecycle: ${error.stack}`);
  } finally {
    release();
    await context.close();
  }
}

try {
  await checkElection();
  await checkElectionLifecycle();
  await checkStudioLoading();
  await checkPlayground();
  for (const path of pages) {
    await visit(path, { width: 1440, height: 900, colorScheme: 'light' });
    await visit(path, { width: 390, height: 844, colorScheme: 'dark' });
  }
  await visit('missing/deep/page', {
    width: 390,
    height: 844,
    colorScheme: 'light',
    expectStatus: 404,
  });
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`Pages check found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `Pages check passed: ${pages.length} pages at 1440 px light and 390 px dark, plus 404.`,
);
