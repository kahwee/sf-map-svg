import { createCheckContext } from './context.mjs';

// Measures and candidates share one pattern: SVG download waits for the map, a failed election
// load offers Retry, and an older slow response never overwrites the newest choice.
const pages = [
  {
    path: 'measures.html',
    data: '**/data/elections/',
    map: '#measure-map',
    download: '#export-svg',
    label: '#measure-eyebrow',
    stale: '2022',
    newest: '2012',
    failing: '2002',
  },
  {
    path: 'candidates.html',
    data: '**/data/candidates/',
    map: '#vote-map',
    download: '#download-svg',
    label: '#vote-status',
    stale: '2022',
    newest: '2024',
    failing: '2016',
  },
];
const files = {
  2002: '2002-11-05',
  2012: '2012-11-06',
  2016: '2016-11-08',
  2022: '2022-11-08',
  2024: '2024-11-05',
};

export async function checkVotePages({ browser, origin, base, fail }) {
  for (const spec of pages) {
    const name = spec.path;
    const context = await createCheckContext(browser, { viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => fail(`${name}: ${error.message}`));
    try {
      // The SVG download stays disabled until the map has drawn.
      let releaseMap;
      const mapHeld = new Promise((resolve) => {
        releaseMap = resolve;
      });
      await page.route('**/maps/display/*.svg', async (route) => {
        await mapHeld;
        await route.continue();
      });
      await page.goto(`${origin}${base}${name}`, { waitUntil: 'domcontentloaded' });
      await page.locator(spec.label).waitFor();
      if (!(await page.locator(spec.download).isDisabled()))
        fail(`${name}: SVG download is enabled before the map is ready`);
      await page.locator(spec.map).scrollIntoViewIfNeeded();
      releaseMap();
      await page.waitForSelector(`${spec.map} svg`);
      await page.waitForFunction(
        (selector) => !document.querySelector(selector).disabled,
        spec.download,
      );
      await page.unroute('**/maps/display/*.svg');

      // A slow older election cannot overwrite a newer choice.
      let releaseStale;
      const staleHeld = new Promise((resolve) => {
        releaseStale = resolve;
      });
      await page.route(`${spec.data}${files[spec.stale]}.json`, async (route) => {
        await staleHeld;
        await route.continue();
      });
      const choose = (year) => page.locator('#election-control button', { hasText: year }).click();
      await choose(spec.stale);
      await choose(spec.newest);
      await page.waitForFunction(
        ([selector, year]) => document.querySelector(selector).textContent.includes(year),
        [spec.label, spec.newest],
      );
      releaseStale();
      await page.waitForTimeout(400);
      if (!(await page.locator(spec.label).textContent()).includes(spec.newest))
        fail(`${name}: a slow older election overwrote the newest choice`);
      await page.unroute(`${spec.data}${files[spec.stale]}.json`);

      // A failed election load shows a Retry button that recovers.
      await page.route(`${spec.data}${files[spec.failing]}.json`, (route) => route.abort());
      await choose(spec.failing);
      const retry = page.locator('.load-retry button', { hasText: 'Retry' });
      await retry.waitFor();
      await page.unroute(`${spec.data}${files[spec.failing]}.json`);
      await retry.click();
      await page.waitForFunction(
        ([selector, year]) => document.querySelector(selector).textContent.includes(year),
        [spec.label, spec.failing],
      );
      if (await page.locator('.load-retry').count())
        fail(`${name}: Retry notice stays after recovery`);

      // A failed map load shows Retry and keeps the download disabled.
      await page.route('**/maps/display/*.svg', (route) => route.abort());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator(spec.map).scrollIntoViewIfNeeded();
      const mapRetry = page.locator(`${spec.map} .load-retry button`);
      await mapRetry.waitFor();
      if (!(await page.locator(spec.download).isDisabled()))
        fail(`${name}: SVG download is enabled after the map failed`);
      await page.unroute('**/maps/display/*.svg');
      await mapRetry.click();
      await page.waitForFunction(
        (selector) => !document.querySelector(selector).disabled,
        spec.download,
      );
    } catch (error) {
      fail(`${name}: ${error.stack}`);
    } finally {
      await context.close();
    }
  }
}
