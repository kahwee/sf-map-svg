import type { Meta, StoryObj } from '@storybook/html-vite';
import { districtYears, renderSFMap } from '../src/index.ts';
import type { SFMapOptions } from '../src/types.ts';

const meta = {
  title: 'Legacy/Static renderer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compatibility API from `@kahwee/sf-map-svg/legacy`. For new maps, start with **Start here / V2 static SVG**, which takes explicit geography.',
      },
    },
  },
  render: (args) => renderSFMap(args),
  args: {
    year: 2022,
    width: 800,
    height: 800,
    padding: 28,
    districtLines: true,
    districtFills: true,
    districtLabels: true,
    labels: true,
    neighborhoodLines: false,
    highways: false,
    keyRoads: false,
    landmarks: false,
    bartStations: false,
    markers: [],
    colors: {},
    title: 'San Francisco map',
  },
  argTypes: {
    theme: { control: 'select', options: ['districts', 'transit'] },
    year: { control: 'select', options: districtYears },
    width: { control: { type: 'range', min: 320, max: 1200, step: 20 } },
    height: { control: { type: 'range', min: 320, max: 1200, step: 20 } },
    padding: { control: { type: 'range', min: 0, max: 100, step: 4 } },
    districtLines: { control: 'boolean' },
    districtFills: { control: 'boolean' },
    districtLabels: { control: 'boolean' },
    labels: { control: 'boolean' },
    neighborhoodLines: { control: 'boolean' },
    highways: { control: 'boolean' },
    keyRoads: { control: 'boolean' },
    landmarks: { control: 'boolean' },
    bartStations: { control: 'boolean' },
    markers: { control: 'object' },
    colors: { control: 'object' },
    title: { control: 'text' },
  },
} satisfies Meta<SFMapOptions>;

export default meta;
type Story = StoryObj<SFMapOptions>;

export const Districts: Story = {};
export const LandmarksAndBART: Story = {
  name: 'Landmarks and BART',
  args: { landmarks: true, bartStations: true, highways: true },
};
export const Neighborhoods: Story = { args: { neighborhoodLines: true } };
export const Outline: Story = {
  args: { districtFills: false, districtLabels: false, landmarks: true, bartStations: true },
};
export const Districts2002: Story = { args: { year: 2002 } };
export const Districts2012: Story = { args: { year: 2012 } };
export const CustomMarkers: Story = {
  args: {
    landmarks: true,
    markers: [
      { id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park', selected: true },
      { id: 'ferry', lng: -122.3937, lat: 37.7955, label: 'Ferry Building', color: '#965c3b' },
    ],
  },
};
export const CustomPalette: Story = {
  args: {
    districtFills: false,
    districtLabels: false,
    landmarks: true,
    bartStations: true,
    highways: true,
    colors: {
      water: '#f3eee3',
      land: '#fffcf3',
      park: '#c4d4b1',
      bart: '#795285',
      highway: '#c59562',
    },
  },
};

export const LandmarksOnly: Story = { args: { landmarks: true } };
export const BARTOnly: Story = { args: { bartStations: true } };
export const Mobile: Story = {
  args: { width: 390, height: 390, landmarks: true, bartStations: true },
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};

export const Transit: Story = {
  args: {
    theme: 'transit',
    districtLabels: false,
    districtLines: false,
    landmarks: true,
    bartStations: true,
    highways: true,
  },
};

export const KeyRoads: Story = {
  args: {
    theme: 'transit',
    keyRoads: true,
    districtLabels: false,
    districtLines: false,
    landmarks: true,
    bartStations: true,
    highways: true,
  },
};

export const LabelsOff: Story = {
  args: { labels: false, landmarks: true, bartStations: true, keyRoads: true },
};
