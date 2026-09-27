import { expect } from 'storybook/test';
import { mountSpotExplorer } from '../website/spot-explorer.js';
import '../website/spot.css';

export default {
  title: 'Data/One spot, three San Franciscos',
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'A point lookup across the three independent neighborhood collections and the 2002, 2012, and 2022 supervisorial maps. The source buttons trace actual polygons; the year buttons use each dated district map.',
      },
    },
  },
  loaders: [() => ({ disposal: {} })],
  beforeEach:
    ({ loaded }) =>
    () =>
      loaded.disposal.atlas?.destroy(),
  render: (_, { loaded }) => {
    const frame = document.createElement('div');
    frame.style.cssText = 'max-width:1240px;margin:auto;padding:20px';
    loaded.disposal.atlas = mountSpotExplorer(frame);
    return frame;
  },
};

export const FerryBuilding = {
  play: async ({ canvasElement, userEvent }) => {
    const cards = canvasElement.querySelectorAll('.spot-source-card');
    expect(cards).toHaveLength(3);
    expect(canvasElement.querySelector('.spot-district-status').textContent).toContain('2022');
    await userEvent.click(cards[1]);
    expect(canvasElement.querySelector('.spot-source-sf-find')).toBeTruthy();
    await userEvent.click(canvasElement.querySelector('[data-year="2012"]'));
    expect(canvasElement.querySelector('.spot-district-status').textContent).toContain('2012');
  },
};

export const Phone390 = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  render: (_, { loaded }) => {
    const frame = document.createElement('div');
    frame.style.cssText = 'width:390px;max-width:100%;margin:auto';
    loaded.disposal.atlas = mountSpotExplorer(frame);
    return frame;
  },
};
