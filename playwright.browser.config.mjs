import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './browser',
  testMatch: '**/*.spec.mjs',
  outputDir: 'test-results/browsers',
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: ['chromium', 'firefox', 'webkit'].flatMap((browserName) =>
    [1440, 390].map((width) => ({
      name: `${browserName}-${width}`,
      use: { browserName, viewport: { width, height: width === 390 ? 844 : 900 } },
    })),
  ),
  webServer: {
    command: 'node scripts/serve-browser-fixture.mjs',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
