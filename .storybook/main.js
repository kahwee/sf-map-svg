/** @type {import('@storybook/html-vite').StorybookConfig} */
export default {
  staticDirs: [{ from: '../data', to: '/data' }],
  stories: ['../stories/**/*.stories.js'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/html-vite',
  core: { disableTelemetry: true },
};
