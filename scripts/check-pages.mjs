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
  'layers.html',
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
  index: 45,
  layers: 45,
  examples: 12,
  measures: 25,
  propositions: 25,
  candidates: 25,
  spot: 15,
  transit: 480,
  docs: 12,
  api: 12,
  404: 12,
};
// Pre-rendered maps and the display dataset, gzip KB.
const mapBudgets = { 'maps/display': 20, 'maps/thumb': 30, 'maps/figures': 30, 'maps/plates': 60 };
const dataBudgets = { 'data/site-map.json': 320 };
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.xml': 'application/xml',
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
    fail(`${name}.html loads ${total.toFixed(1)} KB gzip JS/CSS (budget ${limit} KB)`);
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
              overflow: document.documentElement.scrollWidth - innerWidth,
              toggle: Boolean(
                document.querySelector('.theme-toggle')?.getBoundingClientRect().width,
              ),
            }),
          200,
        );
      }),
  );
  if (result.overflow > 0) fail(`${label}: page scrolls sideways by ${result.overflow}px`);
  if (result.shift > 0.01) fail(`${label}: layout shift ${result.shift.toFixed(4)}`);
  if (!result.toggle) fail(`${label}: theme toggle is not visible`);
  await context.close();
}

try {
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
