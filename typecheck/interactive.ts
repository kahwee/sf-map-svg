import { createMap, type MapViewport } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const map = createMap(fullMapData, {
  mode: 'basemap',
  appearance: { labelSize: { min: 12, max: 16 } },
  layers: { districtFills: false },
  markers: [],
});
const view: MapViewport = map.camera.get();
map.camera.set(view);
map.camera.fit(
  { type: 'MultiPoint', coordinates: [[-122.42, 37.77]] },
  { padding: { bottom: 60 } },
);
map.selectNeighborhood(null, { fit: false });
map.selectMarker(null);
map.setTouchNavigation(false);
map.getSelectedNeighborhood()?.source;
map.destroy();

const enhanced = createMap(fullMapData, {
  appearance: {
    colors: { land: '#223344' },
    labelStyle: { fontFamily: 'DM Sans', haloColor: '#223344' },
  },
  features: { motion: { duration: 300 }, markerEntrance: true, clustering: { radius: 40 } },
  markers: [{ id: 'place', lng: -122.4, lat: 37.7, radius: 8 }],
  legend: { hidden: ['road'], items: [{ label: 'Place', color: '#123456' }] },
});
enhanced.camera.set([0, 0, 800], { animate: false });
enhanced.selectMarker('place', { duration: 250 });
enhanced.projectToScreen(-122.4, 37.7).visible satisfies boolean;
enhanced.overlayElement satisfies HTMLDivElement;
enhanced.camera.stop();
enhanced.configure({ features: { motion: false, clustering: true, selectedMarkerRing: false } });
enhanced.configure({ features: { motion: { duration: 180 }, scaleBar: undefined } });
enhanced.configure({ layers: { landmarks: false, roadLabels: true } });
enhanced.configure({ controls: { zoom: false, reset: true } });
// @ts-expect-error Feature switches must be typed, not arbitrary truthy strings.
enhanced.configure({ features: { clustering: 'yes' } });
// @ts-expect-error Misspelled layer options are not silently accepted.
enhanced.configure({ layers: { park: false } });

for (const overlay of [
  {
    id: 'line',
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-122.4, 37.7],
        [-122.41, 37.71],
      ] as const,
    },
  },
  {
    id: 'lines',
    geometry: {
      type: 'MultiLineString' as const,
      coordinates: [
        [
          [-122.4, 37.7],
          [-122.41, 37.71],
        ],
      ] as const,
    },
  },
  {
    id: 'polygon',
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-122.4, 37.7],
          [-122.41, 37.71],
          [-122.42, 37.72],
          [-122.4, 37.7],
        ],
      ] as const,
    },
  },
  {
    id: 'polygons',
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: [
        [
          [
            [-122.4, 37.7],
            [-122.41, 37.71],
            [-122.42, 37.72],
            [-122.4, 37.7],
          ],
        ],
      ] as const,
    },
  },
])
  enhanced.setOverlays([overlay]);
enhanced.setOverlays([
  // @ts-expect-error Overlay points belong in the marker API.
  { id: 'point', geometry: { type: 'MultiPoint', coordinates: [[-122.4, 37.7]] } },
]);
