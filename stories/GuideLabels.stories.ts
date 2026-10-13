import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { mountGuideController } from '../src/guide-map.js';
import { createGuideShell } from '../src/guide-static.js';
import type { MapController } from '../src/map.js';

let map: MapController | undefined;
const meta = {
  title: 'Checks/Guide labels',
  beforeEach: () => () => map?.destroy(),
  parameters: { layout: 'fullscreen' },
  render: () => {
    const host = document.createElement('div');
    const width = Math.min(window.innerWidth, 802);
    host.style.width = `${width}px`;
    host.innerHTML = createGuideShell({ labelLayout: { width: width - 2 } });
    const button = document.createElement('button');
    button.textContent = 'Enhance map';
    button.onclick = () => {
      const shell = host.querySelector<HTMLElement>('.sf-guide-shell');
      if (!shell) throw new Error('Missing shell');
      map = mountGuideController(shell);
      button.disabled = true;
    };
    host.prepend(button);
    return host;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const before = [...canvasElement.querySelectorAll<SVGTextElement>('[data-label-kind]')];
    expect(before.length).toBeGreaterThan(5);
    const park = before.find((node) => node.textContent === 'Golden Gate Park');
    expect(park).toBeTruthy();
    if (!park) throw new Error('Missing static park label');
    const beforeBox = park.getBoundingClientRect();
    // Test actual rendered glyphs, not just the portable metric estimate.
    const boxes = before.map((node) => node.getBoundingClientRect());
    boxes.forEach((a, index) => {
      boxes.slice(index + 1).forEach((b) => {
        expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top).toBe(
          false,
        );
      });
    });
    canvasElement.querySelector('button')?.click();
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-label-kind]').length).toBeGreaterThan(5),
    );
    const after = [...canvasElement.querySelectorAll<SVGTextElement>('[data-label-kind]')];
    const enhancedPark = after.find((node) => node.textContent === 'Golden Gate Park');
    expect(enhancedPark).toBeTruthy();
    if (!enhancedPark) throw new Error('Missing interactive park label');
    const afterBox = enhancedPark.getBoundingClientRect();
    // The shared anchor and baseline stay stable despite different font measurements.
    expect(Math.abs(beforeBox.top - afterBox.top)).toBeLessThan(1);
    expect(
      Math.abs((beforeBox.left + beforeBox.right) / 2 - (afterBox.left + afterBox.right) / 2),
    ).toBeLessThan(1);
    expect(after.some((node) => node.dataset.labelKind === 'bart')).toBe(false);
    const svg = canvasElement.querySelector('svg');
    svg?.focus();
    expect(document.activeElement).toBe(svg);
    map?.camera.zoom(2);
    await waitFor(() => expect(map?.camera.get()[2]).toBe(400));
    map?.camera.reset();
  },
};
export const Phone: Story = {
  ...Overview,
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};
