import { createCheckContext } from './context.mjs';

export async function checkPlayground({ browser, origin, base, fail }) {
  const context = await createCheckContext(browser, {
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
