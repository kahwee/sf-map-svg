import { expect, test } from 'playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => !!window.harness);
  await page.evaluate(async () => {
    window.harness.mount();
    await window.harness.settle();
  });
  // Assert errors after every test, including errors from deferred render work.
  page.__mapErrors = errors;
});

test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    window.map.destroy();
    await window.harness.settle();
  });
  expect(page.__mapErrors).toEqual([]);
});

const entry = '[data-marker-id][tabindex="0"], [data-cluster-ids][tabindex="0"]';

test('coincident chooser selects either place and Escape restores focus', async ({ page }) => {
  const cluster = page.locator('[data-cluster-ids]');
  await cluster.focus();
  const view = await page.evaluate(() => window.map.camera.get());
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-marker-choice]')).toHaveCount(2);
  expect(await page.evaluate(() => window.map.camera.get())).toEqual(view);
  await page.keyboard.press('Escape');
  await expect(cluster).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Second place', exact: true }).click();
  expect(await page.evaluate(() => window.map.getSelectedMarker()?.id)).toBe('two');
  await expect(page.locator('[data-marker-id="two"]')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('one marker tab stop survives reordering and removal', async ({ page }) => {
  await page.evaluate(async () => {
    window.harness.mount({ features: {}, markers: window.harness.grid(3) });
    await window.harness.settle();
  });
  await expect(page.locator(entry)).toHaveCount(1);
  await page.locator(entry).focus();
  await page.keyboard.press(']');
  await expect(page.locator('[data-marker-id="pin-1"]')).toBeFocused();
  await page.keyboard.press('[');
  await expect(page.locator('[data-marker-id="pin-0"]')).toBeFocused();
  await page.keyboard.press('[');
  await expect(page.locator('[data-marker-id="pin-2"]')).toBeFocused();
  await page.evaluate(() => window.map.setMarkers(window.harness.grid(3).reverse()));
  await expect(page.locator('[data-marker-id="pin-2"]')).toBeFocused();
  await page.evaluate(() => window.map.setMarkers(window.harness.grid(2)));
  await expect(page.locator(entry)).toHaveCount(1);
  await expect(page.locator(entry)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator(entry)).not.toBeFocused();
  await page.evaluate(() => window.map.setMarkers([]));
  await expect(page.locator(entry)).toHaveCount(0);
});

test('separable cluster zooms instead of opening the chooser', async ({ page }) => {
  await page.evaluate(async () => {
    const [one, two] = window.harness.markers;
    window.harness.mount({ markers: [one, { ...two, lng: two.lng + 0.003 }] });
    await window.harness.settle();
  });
  await page.locator('[data-cluster-ids]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-cluster-ids]')).toHaveCount(0);
  expect((await page.evaluate(() => window.map.camera.get()))[2]).toBeLessThan(800);
});

test('keyboard and pointer camera controls work and stop after disposal', async ({ page }) => {
  const svg = page.locator('.sf-explorer-canvas > svg');
  await svg.focus();
  await page.keyboard.press('+');
  const zoomed = await page.evaluate(() => window.map.camera.get());
  expect(zoomed[2]).toBeLessThan(800);
  await page.keyboard.press('ArrowRight');
  expect((await page.evaluate(() => window.map.camera.get()))[0]).toBeGreaterThan(zoomed[0]);
  const before = await page.evaluate(() => window.map.camera.get());
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.map.camera.get())).not.toEqual(before);
  await page.evaluate(() => window.map.destroy());
  const stopped = await svg.getAttribute('viewBox');
  await svg.focus();
  await page.keyboard.press('Home');
  expect(await svg.getAttribute('viewBox')).toEqual(stopped);
  expect(await page.evaluate(() => window.map.destroyed)).toBe(true);
});

test('resize keeps projection aligned and touch mode restores page scrolling', async ({ page }) => {
  await page.evaluate(async () => {
    document.querySelector('#host').style.width = '300px';
    window.map.setTouchNavigation(true);
    await window.harness.settle();
  });
  const canvas = page.locator('.sf-explorer-canvas');
  await expect(canvas).toHaveCSS('touch-action', 'none');
  const error = await page.evaluate(() => {
    const marker = window.harness.markers[2];
    const point = window.map.projectToScreen(marker.lng, marker.lat);
    const node = document.querySelector('[data-marker-id="park"]');
    const matrix = node.getScreenCTM();
    const box = window.map.overlayElement.getBoundingClientRect();
    return Math.max(
      Math.abs(point.x - matrix.e + box.left),
      Math.abs(point.y - matrix.f + box.top),
    );
  });
  expect(error).toBeLessThan(1);
  await page.evaluate(() => window.map.configure({ controls: { touch: false } }));
  await expect(canvas).toHaveCSS('touch-action', 'pan-y pinch-zoom');
});

test('reduced motion overrides animation and marker updates close the chooser', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.map.configure({ features: { motion: true, markerEntrance: true } }),
  );
  await page.locator('[data-cluster-ids]').click();
  await page.evaluate(() => {
    window.map.setMarkers([window.harness.markers[2]]);
    window.map.camera.set([100, 100, 400], { animate: true, duration: 500 });
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.map.camera.get())).toEqual([100, 100, 400]);
  expect(
    await page.evaluate(() => window.map.element.getAnimations({ subtree: true }).length),
  ).toBe(0);
});
