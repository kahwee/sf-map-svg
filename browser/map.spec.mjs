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

test('2000-place viewport culling retains records, nodes, and keyboard focus', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { grid, mount, settle } = window.harness;
    const markers = grid(2000);
    mount({ markers, features: {} });
    await settle();
    const pins = () => [...window.map.element.querySelectorAll('[data-marker-id]')];
    const overview = pins().length;
    window.map.camera.set([100, 100, 200]);
    await settle();
    const zoomed = pins().length;
    const retained = pins()[0];
    const id = retained.dataset.markerId;
    retained.focus();
    window.map.camera.set([500, 500, 200]);
    await settle();
    const focusRetained = document.activeElement === retained && retained.isConnected;
    const tabStops = window.map.element.querySelectorAll('[data-marker-id][tabindex="0"]').length;
    window.map.element.querySelector('button').focus();
    window.map.camera.pan(1, 0);
    await settle();
    const culledAfterBlur = !retained.isConnected;
    window.map.setMarkers(
      markers.map((marker) => ({ ...marker, radius: 9, label: `${marker.label} updated` })),
    );
    window.map.camera.set([100, 100, 200]);
    await settle();
    const returned = window.map.element.querySelector(`[data-marker-id="${id}"]`);
    const identity = returned === retained;
    const radius = Number(returned.querySelector('circle[stroke="#fff9e9"]').getAttribute('r'));
    const expectedRadius =
      (9 * window.map.camera.get()[2]) / window.map.overlayElement.getBoundingClientRect().width;
    const offscreen = markers.find(
      (marker) => !pins().some((node) => node.dataset.markerId === marker.id),
    );
    window.map.selectMarker(offscreen.id);
    await settle();
    const selected = !!window.map.element.querySelector(`[data-marker-id="${offscreen.id}"]`);
    const catalog = window.map.element.querySelectorAll('.sf-explorer-feature-controls select')[1]
      .options.length;
    window.map.selectMarker(null, { fit: false });
    window.map.configure({ features: { clustering: true } });
    window.map.camera.set([100, 100, 400]);
    await settle();
    const clusters = () => [...window.map.element.querySelectorAll('[data-cluster-ids]')];
    const before = new Map(clusters().map((node) => [node.dataset.clusterIds, node]));
    window.map.camera.pan(2, 0);
    await settle();
    const shared = clusters().filter((node) => before.has(node.dataset.clusterIds));
    return {
      overview,
      zoomed,
      focusRetained,
      tabStops,
      culledAfterBlur,
      identity,
      radius,
      expectedRadius,
      selected,
      catalog,
      shared: shared.length,
      stableClusters: shared.every((node) => before.get(node.dataset.clusterIds) === node),
    };
  });
  expect(result.overview).toBeGreaterThan(1500);
  expect(result.zoomed).toBeGreaterThan(0);
  expect(result.zoomed).toBeLessThan(result.overview / 2);
  expect(result.focusRetained).toBe(true);
  expect(result.tabStops).toBe(1);
  expect(result.culledAfterBlur).toBe(true);
  expect(result.identity).toBe(true);
  expect(result.radius).toBeCloseTo(result.expectedRadius, 4);
  expect(result.selected).toBe(true);
  expect(result.catalog).toBe(2001);
  expect(result.shared).toBeGreaterThan(0);
  expect(result.stableClusters).toBe(true);
});

test('clustered catalog creates individual pins only on first visibility or selection', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const original = document.createElementNS;
    const created = [];
    document.createElementNS = function (...args) {
      const node = original.apply(this, args);
      if (args[1] === 'g') created.push(node);
      return node;
    };
    try {
      const { grid, mount, settle } = window.harness;
      const markers = grid(2000);
      mount({ markers });
      await settle();
      const allocated = () => created.filter((node) => node.hasAttribute('data-marker-id'));
      const initial = allocated().length;
      window.map.setMarkers(
        markers.map((marker) => ({
          ...marker,
          label: `${marker.label} fresh`,
          radius: 9,
          color: '#a12345',
        })),
      );
      window.map.configure({
        appearance: { selectedMarkerColor: '#234567' },
        features: { selectedMarkerRing: { color: '#345678' } },
      });
      await settle();
      const afterUpdate = allocated().length;
      window.map.selectMarker(markers[0].id, { fit: false });
      await settle();
      const selected = window.map.element.querySelector('[data-marker-id="pin-0"]');
      const selectedName = selected.getAttribute('aria-label');
      const selectedFill = selected.querySelector('circle[stroke="#fff9e9"]').getAttribute('fill');
      const selectedRing = selected.querySelector('circle[fill="none"]').getAttribute('stroke');
      const selectedCount = allocated().length;
      selected.focus();
      const fresh = markers.map((marker) => ({
        ...marker,
        label: `${marker.label} fresh`,
        radius: 9,
        color: '#a12345',
      }));
      window.map.setMarkers(fresh.slice(1));
      await settle();
      const focusRecovered = document.activeElement?.dataset.markerId === 'pin-1';
      window.map.element.querySelector('button').focus();
      window.map.setMarkers(fresh);
      window.map.selectMarker(null, { fit: false });
      window.map.camera.set([200, 200, 200]);
      window.map.configure({ features: { clustering: false } });
      await settle();
      const zoomCount = allocated().length;
      const pin = Array.from(window.map.element.querySelectorAll('[data-marker-id]')).find(
        (node) => node.dataset.markerId !== 'pin-1',
      );
      const id = pin.dataset.markerId;
      window.map.camera.set([500, 500, 200]);
      await settle();
      const detached = !pin.isConnected;
      window.map.camera.set([200, 200, 200]);
      await settle();
      return {
        initial,
        afterUpdate,
        selectedCount,
        focusRecovered,
        selectedName,
        selectedFill,
        selectedRing,
        zoomCount,
        detached,
        retained: window.map.element.querySelector(`[data-marker-id="${id}"]`) === pin,
        catalog: window.map.element.querySelectorAll('.sf-explorer-feature-controls select')[1]
          .options.length,
      };
    } finally {
      document.createElementNS = original;
    }
  });
  expect(result.initial).toBe(0);
  expect(result.afterUpdate).toBe(0);
  expect(result.selectedCount).toBe(1);
  expect(result.focusRecovered).toBe(true);
  expect(result.selectedName).toContain('fresh');
  expect(result.selectedFill).toBe('#234567');
  expect(result.selectedRing).toBe('#345678');
  expect(result.zoomCount).toBeGreaterThan(1);
  expect(result.zoomCount).toBeLessThan(1000);
  expect(result.detached).toBe(true);
  expect(result.retained).toBe(true);
  expect(result.catalog).toBe(2001);
});
