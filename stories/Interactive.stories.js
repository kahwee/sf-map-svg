import { createInteractiveSFMap } from '../src/interactive.ts';

export default {
  title: 'Maps/Reusable interactive map',
  tags: ['autodocs'],
  args: { mode: 'basemap', theme: 'transit', source: 'realtor' },
  argTypes: {
    mode: { control: 'select', options: ['basemap', 'neighborhoods', 'districts'] },
    theme: { control: 'select', options: ['transit', 'districts'] },
    source: { control: 'select', options: ['realtor', 'sf-find', 'analysis'] },
    layers: { control: 'object' },
    labelSize: { control: 'object' },
  },
  render: ({ narrow, ...options }, { loaded }) => {
    const map = createInteractiveSFMap(options);
    loaded.disposal.map = map;
    if (narrow) map.style.maxWidth = '390px';
    return map;
  },
  loaders: [() => ({ disposal: {} })],
  beforeEach:
    ({ loaded }) =>
    () =>
      loaded.disposal.map?.destroy(),
};
export const PlainBasemap = {};
export const SelectableNeighborhoods = { args: { mode: 'neighborhoods', source: 'analysis' } };
export const DistrictTheme = { args: { mode: 'districts', theme: 'districts' } };
export const IndependentLayers = {
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
export const DenseMarkers = {
  args: {
    markers: Array.from({ length: 36 }, (_, i) => ({
      id: `sample-${i + 1}`,
      label: `Sample marker ${i + 1}`,
      lng: -122.4269 + (i % 3) * 0.002,
      lat: 37.7596 + (i % 2) * 0.002,
    })),
  },
};
export const NarrowMobile = {
  args: {
    ...DenseMarkers.args,
    narrow: true,
    mode: 'neighborhoods',
    labelSize: { min: 12, max: 14 },
  },
};
