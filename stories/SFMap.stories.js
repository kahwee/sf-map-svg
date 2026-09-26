import { districtYears, renderSFMap } from '../src/index.ts';

export default {
  title: 'Maps/San Francisco',
  tags: ['autodocs'],
  render: (args) => renderSFMap(args),
  args: {
    year: 2022,
    width: 800,
    height: 800,
    padding: 28,
    districtLines: true,
    districtFills: true,
    districtLabels: true,
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
    neighborhoodLines: { control: 'boolean' },
    highways: { control: 'boolean' },
    keyRoads: { control: 'boolean' },
    landmarks: { control: 'boolean' },
    bartStations: { control: 'boolean' },
    markers: { control: 'object' },
    colors: { control: 'object' },
    title: { control: 'text' },
  },
};

export const Districts = {};
export const LandmarksAndBART = {
  name: 'Landmarks and BART',
  args: { landmarks: true, bartStations: true, highways: true },
};
export const Neighborhoods = { args: { neighborhoodLines: true } };
export const Outline = {
  args: { districtFills: false, districtLabels: false, landmarks: true, bartStations: true },
};
export const Districts2002 = { args: { year: 2002 } };
export const Districts2012 = { args: { year: 2012 } };
export const CustomMarkers = {
  args: {
    landmarks: true,
    markers: [
      { id: 'dolores', lng: -122.4269, lat: 37.7596, label: 'Dolores Park', selected: true },
      { id: 'ferry', lng: -122.3937, lat: 37.7955, label: 'Ferry Building', color: '#965c3b' },
    ],
  },
};
export const CustomPalette = {
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

export const LandmarksOnly = { args: { landmarks: true } };
export const BARTOnly = { args: { bartStations: true } };
export const Mobile = { args: { width: 390, height: 390, landmarks: true, bartStations: true } };

export const Transit = {
  args: {
    theme: 'transit',
    districtLabels: false,
    districtLines: false,
    landmarks: true,
    bartStations: true,
    highways: true,
  },
};

export const KeyRoads = {
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
