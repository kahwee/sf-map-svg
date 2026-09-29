import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { fullMapData } from '../src/full-data.js';
import { mountSpotExplorer } from '../website/spot-explorer.js';
import { createStoryLifecycle } from './lifecycle.ts';
import '../website/site.css';
import '../website/spot.css';

const lifecycle = createStoryLifecycle();
const meta = {
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
  beforeEach: lifecycle.beforeEach,
  render: (_, { id }) => {
    const frame = document.createElement('div');
    frame.className = 'spot-page';
    frame.style.cssText = 'max-width:1240px;margin:auto;padding:20px';
    const atlas = mountSpotExplorer(frame, { data: fullMapData });
    lifecycle.track(id, () => atlas.destroy());
    return frame;
  },
} satisfies Meta<Record<string, never>>;

export default meta;
type Story = StoryObj<Record<string, never>>;

export const FerryBuilding: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const cards = canvasElement.querySelectorAll<HTMLButtonElement>('.spot-source-card');
    expect(cards).toHaveLength(3);
    expect(canvasElement.querySelector('.spot-district-status')?.textContent).toContain('2022');
    expect(cards[0]?.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(cards[1]);
    expect(canvasElement.querySelector('.spot-card-sf-find')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(canvasElement.querySelector('.spot-source-sf-find')).toBeTruthy();
    const year2012 = canvasElement.querySelector('[data-year="2012"]');
    expect(year2012).toBeTruthy();
    if (!year2012) return;
    await userEvent.click(year2012);
    expect(year2012.getAttribute('aria-pressed')).toBe('true');
    expect(canvasElement.querySelector('.spot-district-status')?.textContent).toContain('2012');
    const year2002 = canvasElement.querySelector<HTMLButtonElement>('[data-year="2002"]');
    expect(year2002).toBeTruthy();
    if (!year2002) return;
    year2002.focus();
    await userEvent.keyboard('{Enter}');
    expect(year2002.getAttribute('aria-pressed')).toBe('true');
    expect(canvasElement.querySelector('.spot-district-status')?.textContent).toContain('2002');
  },
};

export const Phone390: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  render: (_, { id }) => {
    const frame = document.createElement('div');
    frame.className = 'spot-page';
    frame.style.cssText = 'width:390px;max-width:100%;margin:auto';
    const atlas = mountSpotExplorer(frame, { data: fullMapData });
    lifecycle.track(id, () => atlas.destroy());
    return frame;
  },
  play: async ({ canvasElement }) => {
    const explorer = canvasElement.querySelector<HTMLElement>('.spot-explorer');
    expect(explorer).toBeTruthy();
    if (!explorer) return;
    expect(explorer.scrollWidth).toBeLessThanOrEqual(explorer.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  },
};
