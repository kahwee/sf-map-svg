import { createStoryLifecycle } from './lifecycle.ts';

type InteractiveArgs = {
  narrow?: boolean;
  mode: 'basemap' | 'neighborhoods' | 'districts';
  theme: 'transit' | 'districts';
  source: 'realtor' | 'sf-find' | 'analysis';
  layers?: Record<string, boolean>;
  labelSize?: { min: number; max: number };
  markers?: Array<{ id: string; label: string; lng: number; lat: number }>;
};

import type { Meta, StoryObj } from '@storybook/html-vite';
import { createInteractiveSFMap } from '../src/interactive.ts';

const lifecycle = createStoryLifecycle();
const meta = {
  title: 'Legacy/Interactive map',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compatibility API from `@kahwee/sf-map-svg/interactive`. For new applications, use **Start here / V2 interactive map** and import only the geography you supply.',
      },
    },
  },
  args: { mode: 'basemap', theme: 'transit', source: 'realtor' },
  argTypes: {
    mode: { control: 'select', options: ['basemap', 'neighborhoods', 'districts'] },
    theme: { control: 'select', options: ['transit', 'districts'] },
    source: { control: 'select', options: ['realtor', 'sf-find', 'analysis'] },
    layers: { control: 'object' },
    labelSize: { control: 'object' },
  },
  render: ({ narrow, ...options }, { id }) => {
    const map = createInteractiveSFMap(options);
    lifecycle.track(id, () => map.destroy());
    if (narrow) map.style.maxWidth = '390px';
    return map;
  },
  beforeEach: lifecycle.beforeEach,
} satisfies Meta<InteractiveArgs>;

export default meta;
type Story = StoryObj<InteractiveArgs>;

export const PlainBasemap: Story = {};
export const SelectableNeighborhoods: Story = {
  args: { mode: 'neighborhoods', source: 'analysis' },
};
export const DistrictTheme: Story = { args: { mode: 'districts', theme: 'districts' } };
export const IndependentLayers: Story = {
  args: {
    mode: 'neighborhoods',
    layers: {
      districtFills: true,
      districtLines: false,
      districtLabels: false,
      bartStations: false,
    },
  },
};
export const DenseMarkers: Story = {
  args: {
    markers: Array.from({ length: 36 }, (_, i) => ({
      id: `sample-${i + 1}`,
      label: `Sample marker ${i + 1}`,
      lng: -122.4269 + (i % 3) * 0.002,
      lat: 37.7596 + (i % 2) * 0.002,
    })),
  },
};
export const NarrowMobile: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  args: {
    ...DenseMarkers.args,
    narrow: true,
    mode: 'neighborhoods',
    labelSize: { min: 12, max: 14 },
  },
};
