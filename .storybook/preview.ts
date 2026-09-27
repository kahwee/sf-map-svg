import type { Preview } from '@storybook/html-vite';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
    a11y: { test: 'error' },
    viewport: {
      options: {
        desktop1280: {
          name: 'Desktop 1280',
          styles: { width: '1280px', height: '900px' },
          type: 'desktop',
        },
        mobile390: {
          name: 'Phone 390',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
    options: {
      storySort: {
        order: ['Start here', 'Maps', 'Data', 'Legacy', 'Checks'],
      },
    },
    docs: {
      description: {
        component:
          'Offline SVG maps of San Francisco. Toggle independent layers and export the resulting SVG. Park and BART overlays show current geography regardless of district year.',
      },
    },
  },
};

export default preview;
