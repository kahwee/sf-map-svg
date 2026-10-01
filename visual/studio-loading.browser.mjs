// Run after pnpm build:pages: node visual/studio-loading.browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../pages-dist/', import.meta.url));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
async function servePreview(route) {
  try {
    const path = resolve(root, `.${new URL(route.request().url()).pathname}`);
    if (!path.startsWith(`${resolve(root)}${sep}`)) throw new Error('Outside preview');
    const body = await readFile(path);
    await route.fulfill({ body, contentType: types[extname(path)] ?? 'application/octet-stream' });
  } catch {
    await route.fulfill({ status: 404 });
  }
}
let browser;
try {
  const url = 'http://studio.test/layers.html';
  browser = await chromium.launch({ headless: true });
  for (const fail of [false, true]) {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.route('http://studio.test/**', servePreview);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let release;
    const held = new Promise((done) => {
      release = done;
    });
    const requestStarted = page.waitForRequest('**/data/site-map.json');
    await page.route('**/data/site-map.json', async (route) => {
      await held;
      if (fail) await route.fulfill({ status: 503, body: 'Unavailable' });
      else await servePreview(route);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await requestStarted;
    await page.locator('#render-control button[data-value="static"]').click();
    assert.equal(await page.locator('#download').isDisabled(), true);
    assert.equal(await page.locator('#replay').isDisabled(), true);
    assert.equal(await page.locator('#mode-control button').first().isDisabled(), true);
    assert.equal(await page.locator('#source-control input').first().isDisabled(), true);
    // Programmatic events also need guards; disabled controls only prevent user clicks.
    await page.evaluate(() => {
      document.getElementById('download').dispatchEvent(new Event('click'));
      document.getElementById('replay').dispatchEvent(new Event('click'));
    });
    assert.match(await page.locator('#studio-map').innerText(), /Loading the map/);
    assert.match(await page.locator('#studio-code').innerText(), /renderMap/);
    if (fail) {
      // Error reporting must not assume the initial loading node still exists.
      await page.locator('#studio-map .stage-loading').evaluate((node) => node.remove());
    }
    release();
    if (fail) {
      await page.locator('#studio-map .stage-loading').waitFor();
      await page.waitForFunction(() =>
        document.getElementById('studio-map').textContent.includes('The map could not load.'),
      );
      assert.equal(await page.locator('#studio-map').getAttribute('aria-busy'), 'false');
      assert.equal(await page.locator('#download').isDisabled(), true);
      // Rendering choices remain safe even after a failed load.
      await page.locator('#render-control button[data-value="interactive"]').click();
      await page.locator('#render-control button[data-value="static"]').click();
      assert.match(await page.locator('#studio-map').innerText(), /The map could not load/);
    } else {
      await page.locator('#studio-map .studio-static svg').waitFor();
      assert.equal(await page.locator('#studio-map .sf-explorer').count(), 0);
      assert.equal(await page.locator('#download').isDisabled(), false);
      assert.equal(await page.locator('#source-control input[value="realtor"]').isChecked(), true);
      const downloaded = page.waitForEvent('download');
      await page.locator('#download').click();
      const download = await downloaded;
      assert.equal(download.suggestedFilename(), 'sf-map-neighborhoods-2022.svg');
      const stream = await download.createReadStream();
      let svg = '';
      for await (const chunk of stream) svg += chunk;
      assert.match(svg, /<svg\b/);
      assert.match(svg, /data-year="2022"/);
      await page.locator('#render-control button[data-value="interactive"]').click();
      await page.locator('#studio-map .sf-explorer').waitFor();
      assert.match(await page.locator('#studio-code').innerText(), /createMap/);
    }
    assert.deepEqual(
      errors,
      [],
      fail ? 'Failed data request caused an uncaught error' : 'Loading race',
    );
    await page.close();
  }
  console.log('Studio delayed-load and failed-load browser checks passed.');
} finally {
  await browser?.close();
}
