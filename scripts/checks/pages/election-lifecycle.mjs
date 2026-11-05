import { createCheckContext } from './context.mjs';
import { electionWithOfficialHistory } from './election-fixture.mjs';

export async function checkElectionLifecycle({ browser, origin, base, fail }) {
  const context = await createCheckContext(browser, { viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const data = await electionWithOfficialHistory();
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
        response.contests.find((c) => c.id === 'state-1').shortTitle = 'Older cached title';
      }
      await route.fulfill({ json: response });
    });
    await page.goto(`${origin}${base}election.html?contest=state-1`);
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
