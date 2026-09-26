import type { Preview } from '@storybook/html-vite';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
    a11y: { test: 'todo' },
    docs: {
      description: {
        component:
          'Offline SVG maps of San Francisco. Toggle independent layers and export the resulting SVG. Park and BART overlays show current geography regardless of district year.',
      },
    },
  },
};

export default preview;
