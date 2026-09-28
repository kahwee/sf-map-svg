import { createStoryLifecycle } from './lifecycle.ts';

type GuideArgs = {
  narrow: boolean;
  zoomed: boolean;
  layers: Record<string, boolean>;
  controls?: Record<string, boolean>;
  strings?: Record<string, string>;
};

import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createGuideController, type MapController } from '../src/guide.ts';

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
const controllers = new WeakMap<HTMLElement, MapController>();
const meta = {
  title: 'Maps/Lightweight guide',
  tags: ['autodocs'],
  // The map fills its container; a centered layout collapses it to zero width.
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The lightweight guide controller uses the same grouped options, events, camera, and lifecycle as createMap. Existing element-based guide factories remain compatible. Detailed geography loads only when requested.',
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
    const map = createGuideController({ ...options, markers: markerSet, overlays: [route] });
    if (zoomed) map.camera.zoom(2.2);
    if (narrow) map.element.style.maxWidth = '390px';
    controllers.set(map.element, map);
    lifecycle.track(id, () => map.destroy());
    return map.element;
  },
  beforeEach: lifecycle.beforeEach,
} satisfies Meta<GuideArgs>;

export default meta;
type Story = StoryObj<GuideArgs>;

export const CityScale: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const map = canvasElement.querySelector<HTMLElement>('.sf-explorer');
    expect(map).toBeTruthy();
    const zoom = map?.querySelector('button[aria-label="Zoom in"]');
    expect(zoom).toBeTruthy();
    if (!zoom) return;
    if (!map) return;
    const controller = controllers.get(map);
    if (!controller) throw new Error('Missing guide controller');
    const before = controller.camera.get()[2];
    await userEvent.click(zoom);
    expect(controller.camera.get()[2]).toBeLessThan(before);
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
