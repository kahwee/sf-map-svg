import { createCheckContext } from './context.mjs';
export async function checkStudioLoading({ browser, origin, base, fail }) {
  const context = await createCheckContext(browser, { viewport: { width: 390, height: 844 } });
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
