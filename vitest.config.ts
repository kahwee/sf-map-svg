import { resolve } from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.json', 'src/**/*.d.ts'],
      reportsDirectory: 'coverage/storybook',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 65,
        lines: 70,
      },
    },
    projects: [
      {
        plugins: [
          storybookTest({
            configDir: resolve('.storybook'),
            tags: { include: ['test'] },
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
