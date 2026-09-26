import { createGuideMap } from '../src/guide.ts';

const markerSet = [
  { id: 'de-young', label: 'de Young Museum', lng: -122.4687, lat: 37.7704 },
  { id: 'conservatory', label: 'Conservatory of Flowers', lng: -122.4608, lat: 37.7729 },
];
const route = {
  id: 'sample-park-route',
  label: 'Sample route supplied by the consumer',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-122.51, 37.769],
      [-122.49, 37.769],
      [-122.47, 37.769],
    ],
  },
  stroke: '#315f54',
  strokeWidth: 3,
};

export default {
  title: 'Maps/Lightweight guide',
  tags: ['autodocs'],
  args: { narrow: false, zoomed: false, layers: {} },
  argTypes: {
    narrow: { control: 'boolean' },
    zoomed: { control: 'boolean' },
    layers: { control: 'object' },
  },
  render: ({ narrow, zoomed, ...options }, { loaded }) => {
    const map = createGuideMap({ ...options, markers: markerSet, overlays: [route] });
    if (zoomed) map.zoomBy(2.2);
    if (narrow) map.style.maxWidth = '390px';
    loaded.disposal.map = map;
    return map;
  },
  loaders: [() => ({ disposal: {} })],
  beforeEach:
    ({ loaded }) =>
    () =>
      loaded.disposal.map?.destroy(),
};

export const CityScale = {};
export const NeighborhoodScale = { args: { zoomed: true } };
export const Mobile390px = { args: { narrow: true } };
export const IndependentRoadLabels = {
  args: { layers: { keyRoads: false, roadLabels: true } },
};
