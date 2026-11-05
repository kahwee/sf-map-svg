import { createCheckContext } from './context.mjs';
export async function visit(
  { browser, origin, base, fail },
  path,
  { width, height, colorScheme, expectStatus = 200 },
) {
  const context = await createCheckContext(browser, { viewport: { width, height }, colorScheme });
  try {
    const page = await context.newPage();
    const label = `${path || 'index'} @${width} ${colorScheme}`;
    page.on('pageerror', (error) => fail(`${label}: ${error.message}`));
    page.on('console', (message) => {
      // Failed requests are reported precisely by the response listener below.
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
        fail(`${label}: console error: ${message.text()}`);
    });
    page.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(origin) && response.status() >= 400 && url !== `${origin}${base}${path}`)
        fail(`${label}: ${response.status()} for ${url.slice(origin.length)}`);
    });
    const response = await page.goto(`${origin}${base}${path}`, { waitUntil: 'load' });
    if (response.status() !== expectStatus)
      fail(`${label}: expected HTTP ${expectStatus}, got ${response.status()}`);
    await page.waitForTimeout(2500);
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let shift = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) shift += entry.value;
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(
            () =>
              resolve({
                shift,
                title: document.title,
                generatedSocialTitle: document.querySelector('meta[data-generated-social]')
                  ?.content,
                overflow: document.documentElement.scrollWidth - innerWidth,
                toggle: Boolean(
                  document.querySelector('.theme-toggle')?.getBoundingClientRect().width,
                ),
              }),
            200,
          );
        }),
    );
    if (result.generatedSocialTitle && result.generatedSocialTitle !== result.title)
      fail(`${label}: generated social title differs from the page title`);
    if (result.overflow > 0) fail(`${label}: page scrolls sideways by ${result.overflow}px`);
    if (result.shift > 0.01) fail(`${label}: layout shift ${result.shift.toFixed(4)}`);
    if (!result.toggle) fail(`${label}: theme toggle is not visible`);
    if (path === 'examples.html') {
      try {
        const videos = page.locator('#marker-recordings video');
        if ((await videos.count()) !== 2) throw new Error('Expected desktop and phone recordings');
        const eagerVideo = await page.evaluate(() =>
          performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('.webm')),
        );
        if (eagerVideo) fail(`${label}: recording downloaded before playback`);
        for (const video of await videos.all()) {
          await video.evaluate(async (node) => {
            node.muted = true;
            node.textTracks[0].mode = 'hidden';
            await node.play();
            node.pause();
          });
        }
        await page.waitForFunction(() =>
          [...document.querySelectorAll('#marker-recordings video')].every(
            (video) =>
              video.readyState >= 2 &&
              video.videoWidth === Number(video.getAttribute('width')) &&
              video.videoHeight === Number(video.getAttribute('height')) &&
              video.textTracks[0]?.cues?.length > 0,
          ),
        );
      } catch (error) {
        fail(`${label}: recording playback/captions: ${error.message}`);
      }
    }
  } finally {
    await context.close();
  }
}
