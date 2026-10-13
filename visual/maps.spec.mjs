import { expect, test } from 'playwright/test';

const spotStory =
  '/storybook-static/iframe.html?id=data-one-spot-three-san-franciscos--ferry-building&viewMode=story';
const phoneStory =
  '/storybook-static/iframe.html?id=data-one-spot-three-san-franciscos--phone-390&viewMode=story';
const staticStory =
  '/storybook-static/iframe.html?id=start-here-static-svg--phone-390&viewMode=story';

async function ready(page) {
  await page.locator('.spot-explorer').waitFor();
  await page.evaluate(() => document.fonts.ready);
  // The explorer's toolbar rule comes from spot.css, so styles have applied.
  await expect(page.locator('.spot-toolbar')).toHaveCSS('border-bottom-style', 'solid');
}

async function comparePoint(page) {
  await page.locator('.spot-card-sf-find').click();
  await page.locator('[data-year="2012"]').click();
  await expect(page.locator('.spot-card-sf-find')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.spot-district-status')).toContainText('2012');
}

for (const colorScheme of ['light', 'dark']) {
  for (const size of ['desktop', 'phone']) {
    test(`Storybook map: ${size} in ${colorScheme} theme`, async ({ page }) => {
      await page.setViewportSize(
        size === 'desktop' ? { width: 1280, height: 900 } : { width: 390, height: 844 },
      );
      await page.emulateMedia({ colorScheme });
      await page.goto(size === 'desktop' ? spotStory : phoneStory);
      await ready(page);
      if (size === 'desktop') await comparePoint(page);
      // Prove that the map adopted the theme, not just the browser preference.
      await expect(page.locator('svg[data-sf-map] > rect').first()).toHaveCSS(
        'fill',
        colorScheme === 'dark' ? 'rgb(18, 42, 48)' : 'rgb(231, 240, 243)',
      );
      await expect(page.locator('.spot-explorer')).toHaveScreenshot(
        `storybook-spot-${size}-${colorScheme}.png`,
      );
    });
  }
}

for (const colorScheme of ['light', 'dark']) {
  test(`Storybook static SVG: phone in ${colorScheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto(staticStory);
    const svg = page.locator('#storybook-root svg');
    await expect(svg).toBeVisible();
    await expect(svg.locator('path')).not.toHaveCount(0);
    await expect(svg).toHaveScreenshot(`storybook-static-phone-${colorScheme}.png`);
  });
}

test('Pages map: source and year at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/pages-dist/spot.html');
  await page.locator('#spot-experience').scrollIntoViewIfNeeded();
  await ready(page);
  await comparePoint(page);
  await expect(page.locator('.spot-explorer')).toHaveScreenshot('pages-spot-desktop-light.png');
});

test('Pages map: default view at phone width in dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/pages-dist/spot.html');
  await page.locator('#spot-experience').scrollIntoViewIfNeeded();
  await ready(page);
  await expect(page.locator('.spot-explorer')).toHaveScreenshot('pages-spot-phone-dark.png');
});
