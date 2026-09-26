/** @type {import('@storybook/html-vite').StorybookConfig} */
export default {
  stories: ['../stories/**/*.stories.js'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/html-vite',
  core: { disableTelemetry: true },
};
