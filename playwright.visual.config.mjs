import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './visual',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'node scripts/serve-visual.mjs',
    url: 'http://127.0.0.1:4174/storybook-static/iframe.html',
    reuseExistingServer: false,
    stderr: 'ignore',
    timeout: 30_000,
  },
});
