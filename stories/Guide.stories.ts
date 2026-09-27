import { createStoryLifecycle } from './lifecycle.ts';

type GuideArgs = {
  narrow: boolean;
  zoomed: boolean;
  layers: Record<string, boolean>;
  interface?: 'map';
  controls?: Record<string, boolean>;
  strings?: Record<string, string>;
};

import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createGuideMap } from '../src/guide.ts';
import type { NeighborhoodExplorerElement } from '../src/types.ts';

const markerSet = [
  { id: 'de-young', label: 'de Young Museum', lng: -122.4687, lat: 37.7704 },
  { id: 'conservatory', label: 'Conservatory of Flowers', lng: -122.4608, lat: 37.7729 },
];
const route = {
  id: 'sample-park-route',
  label: 'Sample route supplied by the consumer',
  geometry: {
    type: 'LineString' as const,
    coordinates: [
      [-122.51, 37.769],
      [-122.49, 37.769],
      [-122.47, 37.769],
    ] as [number, number][],
  },
  stroke: '#315f54',
  strokeWidth: 3,
};

const lifecycle = createStoryLifecycle();
const meta = {
  title: 'Maps/Lightweight guide',
  tags: ['autodocs'],
  // The map fills its container; a centered layout collapses it to zero width.
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Compatibility convenience preset from `@kahwee/sf-map-svg/guide`. For a new controller with explicit geography, see **Start here / V2 interactive map**. The guide keeps a compact overview and loads details only when requested.',
      },
    },
  },
  args: { narrow: false, zoomed: false, layers: {} },
  argTypes: {
    narrow: { control: 'boolean' },
    zoomed: { control: 'boolean' },
    layers: { control: 'object' },
  },
  render: ({ narrow, zoomed, ...options }, { id }) => {
    const map = createGuideMap({ ...options, markers: markerSet, overlays: [route] });
    if (zoomed) map.zoomBy(2.2);
    if (narrow) map.style.maxWidth = '390px';
    lifecycle.track(id, () => map.destroy());
    return map;
  },
  beforeEach: lifecycle.beforeEach,
} satisfies Meta<GuideArgs>;

export default meta;
type Story = StoryObj<GuideArgs>;

export const CityScale: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const map = canvasElement.querySelector<NeighborhoodExplorerElement>('.sf-explorer');
    expect(map).toBeTruthy();
    const zoom = map?.querySelector('button[aria-label="Zoom in"]');
    expect(zoom).toBeTruthy();
    if (!zoom) return;
    if (!map) return;
    const before = map.getViewport()[2];
    await userEvent.click(zoom);
    expect(map.getViewport()[2]).toBeLessThan(before);
  },
};
export const NeighborhoodScale: Story = { args: { zoomed: true } };
export const Mobile390px: Story = {
  args: { narrow: true },
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};
export const IndependentRoadLabels: Story = {
  args: { layers: { keyRoads: false, roadLabels: true } },
};
export const CompactEmbed: Story = {
  args: {
    interface: 'map',
    controls: {
      labels: false,
      neighborhoodPicker: false,
      markerPicker: false,
      help: false,
      status: false,
    },
    strings: { chooseMarker: 'Place on map' },
  },
};
