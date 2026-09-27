import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createTransitAnimation } from '../src/transit.ts';
import { createStoryLifecycle } from './lifecycle.ts';

const lifecycle = createStoryLifecycle();
const meta = {
  title: 'Maps/Transit animation',
  parameters: {
    docs: {
      description: {
        component:
          'Optional schematic BART journey. Station positions are geographic; straight connecting lines do not show track alignment or live service. Playback starts paused and the component owns its animation lifecycle.',
      },
    },
  },
  render: (_, { id }) => {
    const map = createTransitAnimation();
    lifecycle.track(id, () => map.destroy());
    return map;
  },
  beforeEach: lifecycle.beforeEach,
} satisfies Meta<Record<string, never>>;

export default meta;
type Story = StoryObj<Record<string, never>>;

export const SchematicBART: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('div')?.shadowRoot;
    const button = root?.querySelector('button');
    const slider = root?.querySelector<HTMLInputElement>('input[aria-label="Journey progress"]');
    expect(button?.textContent).toBe('Play');
    expect(slider?.value).toBe('0');
    if (!button || !slider) return;
    await userEvent.click(button);
    expect(button.textContent).toBe('Pause');
    await userEvent.click(button);
    expect(button.textContent).toBe('Play');
    slider.value = '500';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root?.querySelector('output')?.textContent).toContain('→');
  },
};

export const Phone390: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('div');
    expect(host).toBeTruthy();
    if (!host) return;
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
  },
};
