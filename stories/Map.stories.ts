import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createMap, type MapController } from '../src/api.ts';
import { guideMapData } from '../src/guide-data.ts';
import { guideOptions } from '../src/presets.ts';
import { createStoryLifecycle } from './lifecycle.ts';

type DemoArgs = { theme: 'districts' | 'transit'; showMarkers: boolean; showRoads: boolean };

const places = [
  { id: 'dolores', label: 'Dolores Park', lng: -122.4269, lat: 37.7596 },
  { id: 'ferry', label: 'Ferry Building', lng: -122.3937, lat: 37.7955 },
];
const controllers = new WeakMap<HTMLElement, MapController>();
const lifecycle = createStoryLifecycle();
const meta = {
  title: 'Start here/Interactive map',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The root contains no geographic JSON. Import `createMap` from `@kahwee/sf-map-svg`, `guideMapData` from `@kahwee/sf-map-svg/guide/data`, and optional `guideOptions` from `@kahwee/sf-map-svg/presets`. Mount `map.element`; call `map.destroy()` when your view is removed. Controls below change construction options without changing the source data.',
      },
    },
  },
  args: { theme: 'districts', showMarkers: false, showRoads: true },
  argTypes: {
    theme: { control: 'select', options: ['districts', 'transit'] },
    showMarkers: { control: 'boolean', description: 'Add two consumer-supplied places.' },
    showRoads: { control: 'boolean', description: 'Show the optional road layers.' },
  },
  beforeEach: lifecycle.beforeEach,
  render: ({ theme, showMarkers, showRoads }: DemoArgs, { id }) => {
    const controller = createMap(guideMapData, {
      ...guideOptions,
      appearance: { theme },
      layers: { ...guideOptions.layers, highways: showRoads, keyRoads: showRoads },
      markers: showMarkers ? places : [],
      attribution: 'compact',
    });
    const frame = document.createElement('div');
    frame.style.cssText = 'width:100%;max-width:960px;margin:auto';
    lifecycle.track(id, () => controller.destroy());
    controllers.set(controller.element, controller);
    frame.append(controller.element);
    return frame;
  },
} satisfies Meta<DemoArgs>;

export default meta;
type Story = StoryObj<DemoArgs>;

export const CityOverview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The smallest interactive starting point: explicit overview geography, a reusable preset, and a controller owned by the view.',
      },
      source: {
        code: `import { createMap } from '@kahwee/sf-map-svg';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';
import { guideOptions } from '@kahwee/sf-map-svg/presets';

const map = createMap(guideMapData, { ...guideOptions });
document.querySelector('#map').append(map.element);
// When the view is removed: map.destroy();`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const map = canvasElement.querySelector<HTMLElement>('.sf-explorer');
    const current = map ? controllers.get(map) : undefined;
    expect(map).toBeTruthy();
    expect(current?.getConfiguration().layers.neighborhoodLines).toBe(true);
    const zoom = map?.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]');
    expect(zoom).toBeTruthy();
    if (!zoom || !current) return;
    const before = current.camera.get()[2];
    await userEvent.click(zoom);
    expect(current.camera.get()[2]).toBeLessThan(before);
    const reset = map?.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset map to city view"]',
    );
    expect(reset).toBeTruthy();
    if (!reset || !map) return;
    await userEvent.click(reset);
    expect(current.camera.get()[2]).toBe(800);
  },
};

export const ConsumerMarkers: Story = {
  args: { showMarkers: true },
  parameters: {
    docs: {
      description: {
        story:
          'Markers belong to the caller. The picker keeps overlapping or small pins reachable by keyboard and touch.',
      },
      source: {
        code: `const map = createMap(guideMapData, {
  ...guideOptions,
  markers: [
    { id: 'dolores', label: 'Dolores Park', lng: -122.4269, lat: 37.7596 },
    { id: 'ferry', label: 'Ferry Building', lng: -122.3937, lat: 37.7955 },
  ],
});
map.on('markerchange', ({ marker }) => console.log(marker?.label));`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const map = canvasElement.querySelector<HTMLElement>('.sf-explorer');
    const current = map ? controllers.get(map) : undefined;
    const picker = map?.querySelectorAll<HTMLSelectElement>(
      '.sf-explorer-feature-controls select',
    )[1];
    expect(picker).toBeTruthy();
    if (!picker || !current) return;
    await userEvent.selectOptions(picker, 'ferry');
    expect(current.getSelectedMarker()?.id).toBe('ferry');
    const pin = map?.querySelector<SVGElement>('[data-marker-id="dolores"]');
    pin?.focus();
    await userEvent.keyboard('{Enter}');
    expect(current.getSelectedMarker()?.id).toBe('dolores');
  },
};

export const TransitPalette: Story = {
  args: { theme: 'transit', showMarkers: true },
  parameters: {
    docs: {
      description: {
        story: 'A different appearance with the same source data and controller API.',
      },
    },
  },
};

export const Phone390: Story = {
  args: { showMarkers: true },
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'The Storybook canvas itself is 390 px wide. Inspect the map controls, labels, and page overflow at a real phone viewport.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLElement>('.sf-explorer');
    expect(map).toBeTruthy();
    if (!map) return;
    expect(map.scrollWidth).toBeLessThanOrEqual(map.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  },
};
