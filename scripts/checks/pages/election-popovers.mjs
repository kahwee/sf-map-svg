import { chromium } from 'playwright';
import { createCheckContext } from './context.mjs';
import { electionWithOfficialHistory } from './election-fixture.mjs';

export async function checkPopoverViewport({ origin, base, fail }) {
  // Playwright normally hides scrollbars; keep a real gutter so innerWidth
  // cannot accidentally satisfy the usable-viewport assertion.
  const history = await electionWithOfficialHistory();
  const gutterBrowser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    for (const width of [1180, 390, 320]) {
      const context = await createCheckContext(gutterBrowser, {
        viewport: { width, height: 844 },
        hasTouch: width < 500,
      });
      try {
        const page = await context.newPage();
        await page.route('**/elections/2026-11-03.json', (route) =>
          route.fulfill({ json: history }),
        );
        await page.goto(`${origin}${base}election.html?contest=state-1`);
        await page.locator('.chart-point-target').first().waitFor();
        await page.addStyleTag({
          content:
            'html { overflow-y: scroll; scrollbar-gutter: stable; } ::-webkit-scrollbar { width: 15px; }',
        });
        // The scrollbar gutter applies a frame after the style tag; wait for it instead of racing it.
        await page
          .waitForFunction(() => document.documentElement.clientWidth < window.innerWidth, null, {
            timeout: 3000,
          })
          .catch(() => {});
        const viewport = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
          outerWidth: window.innerWidth,
        }));
        if (viewport.width >= viewport.outerWidth)
          fail(`popover: ${width}px test did not reserve a real scrollbar gutter`);
        const targets = page.locator('.chart-point-target');
        const half = (await targets.count()) / 2;
        for (const index of [0, half - 1, half, half * 2 - 1]) {
          const target = targets.nth(index);
          await target.scrollIntoViewIfNeeded();
          await target.focus();
          await page.keyboard.press('Enter');
          const popup = page.locator('.chart-point-popover');
          const box = await popup.boundingBox();
          if (
            !box ||
            box.x < 8 ||
            box.y < 8 ||
            box.x + box.width > viewport.width - 8 + 0.5 ||
            box.y + box.height > viewport.height - 8 + 0.5
          )
            fail(
              `popover: ${width}px point ${index} exceeds usable viewport ${JSON.stringify({ viewport, box })}`,
            );
          await popup.getByRole('button', { name: 'Close', exact: true }).click();
          if (!(await target.evaluate((node) => document.activeElement === node)))
            fail('popover: Close did not restore point focus');
        }
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    fail(`popover viewport: ${error.stack}`);
  } finally {
    await gutterBrowser.close();
  }
}
