import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createGuideMap } from '../src/guide.ts';
import type { InteractiveSFMapElement } from '../src/interactive-data.ts';

let currentMap: InteractiveSFMapElement | undefined;

const meta = {
  title: 'Checks/Interactive guide',
  parameters: { layout: 'padded' },
  beforeEach: () => () => currentMap?.destroy(),
  render: () => {
    currentMap = createGuideMap({
      markers: [
        { id: 'first', label: 'First place', lng: -122.4269, lat: 37.7596 },
        { id: 'second', label: 'Second place', lng: -122.4269, lat: 37.7596 },
      ],
      overlays: [
        {
          id: 'route',
          label: 'Example route',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-122.43, 37.75],
              [-122.4, 37.79],
            ],
          },
        },
      ],
    });
    return currentMap;
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverlappingMarkersAndRoute: Story = {
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement, userEvent }) => {
    const map = canvasElement.querySelector<InteractiveSFMapElement>('.sf-explorer');
    await expect(map).toBeTruthy();
    if (!map) return;
    await expect(map.querySelectorAll('[data-marker-id]')).toHaveLength(2);
    await expect(map.querySelector('[data-overlay-id="route"]')).toHaveAttribute(
      'aria-label',
      'Example route',
    );
    const markerSelect = map.querySelectorAll<HTMLSelectElement>(
      '.sf-explorer-feature-controls select',
    )[1];
    await expect(markerSelect).toBeTruthy();
    if (!markerSelect) return;
    await userEvent.selectOptions(markerSelect, 'second');
    await expect(map.getSelectedMarker()?.id).toBe('second');
    const first = map.querySelector<SVGElement>('[data-marker-id="first"]');
    first?.focus();
    await userEvent.keyboard('{Enter}');
    await expect(map.getSelectedMarker()?.id).toBe('first');
  },
};
