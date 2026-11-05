import { readFile } from 'node:fs/promises';
import { createCheckContext } from './context.mjs';
import { stepSelect } from './controls.mjs';

export async function checkElection({ browser, origin, base, fail }) {
  const context = await createCheckContext(browser, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}${base}election.html`);
    await page.locator('#contests article').first().waitFor();
    if (await page.locator('#election-map, .election-region').count())
      fail('election: unavailable geography reserves a map');
    if (await page.locator('#district-filter').isVisible())
      fail('election: measure view shows candidate-only district filter');
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
    await stepSelect(page, page.locator('#contest-select'));
    if (!(await page.locator('#contests h2').textContent()).includes('city-owned bank'))
      fail('election: keyboard contest switch failed');
    await page.locator('#contest-select').selectOption('local-G');
    if (!(await page.locator('.contest-summary').textContent()).includes('Monday'))
      fail('election: summary did not change');
    const historyPosition = await page.locator('.batch-history').boundingBox();
    const explanationPosition = await page.locator('.contest-explanation').boundingBox();
    if (!historyPosition || !explanationPosition || historyPosition.y <= explanationPosition.y)
      fail('election: measure explanation is not adjacent to the title');
    // The committed ballot has no official local counts yet: Pending, never a newsroom substitute.
    if (!(await page.locator('.vote-list').textContent()).includes('Pending'))
      fail('election: local measure without official counts must read Pending');
    if (await page.locator('[data-media-tally], [data-media-projection]').count())
      fail('election: secondary tally markup remains');
    if (/KQED|Chronicle|newsroom|MTC/i.test(await page.locator('main').textContent()))
      fail('election: page mentions a secondary source');
    if (await page.locator('.history-table-wrap').isVisible())
      fail('election: history table should be hidden in default Chart view');
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
    const targets = page.getByRole('button', { name: /^(Yes|No),.*official report/ });
    if ((await targets.count()) !== 4)
      fail('election: point controls are hidden from assistive technology');
    await targets.first().focus();
    await page.keyboard.press('Enter');
    if (
      !(await page.locator('.chart-point-popover').isVisible()) ||
      !(await page.locator('.chart-point-popover').textContent()).includes('Official report')
    )
      fail('election: keyboard point popover lacks the official report');
    await page.keyboard.press('Escape');
    if (await page.locator('.chart-point-popover').isVisible())
      fail('election: Escape did not dismiss point popover');
    await targets.last().tap();
    const popoverBox = await page.locator('.chart-point-popover').boundingBox();
    if (
      !popoverBox ||
      popoverBox.x < 0 ||
      popoverBox.x + popoverBox.width > 390 ||
      popoverBox.y < 0 ||
      popoverBox.y + popoverBox.height > 844
    )
      fail('election: mobile popover clips the viewport');
    await page.locator('#contests h2').click();
    if (await page.locator('.chart-point-popover').isVisible())
      fail('election: outside click did not dismiss popover');
    await stepSelect(page, page.getByLabel('Measure', { exact: true }));
    if (!(await page.locator('.history-table-wrap').textContent()).includes('44.0%'))
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
