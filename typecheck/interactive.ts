import { createInteractiveSFMap, type MapViewport } from '../dist/src/interactive.js';

const map = createInteractiveSFMap({
  mode: 'basemap',
  labelSize: { min: 12, max: 16 },
  layers: { districtFills: false },
  markers: [],
});
const view: MapViewport = map.getViewport();
map.setViewport(view);
map.fitGeometry({ type: 'MultiPoint', coordinates: [[-122.42, 37.77]] }, { bottom: 60 });
map.selectNeighborhood(null, { fit: false });
map.selectMarker(null);
map.setTouchNavigation(false);
map.getSelection()?.source;
map.destroy();

createInteractiveSFMap({
  interface: 'map',
  controls: { neighborhoodPicker: false, markerPicker: false, help: false, status: false },
  strings: { chooseMarker: 'Place on map' },
}).destroy();

// Consumer-facing enhancement options and coordinate/camera APIs.
const enhanced = createInteractiveSFMap({
  colors: { land: '#223344' },
  labelStyle: { fontFamily: 'DM Sans', haloColor: '#223344' },
  motion: { duration: 300 },
  markerEntrance: true,
  clustering: { radius: 40 },
  markers: [{ id: 'place', lng: -122.4, lat: 37.7, radius: 8 }],
  legend: { hidden: ['road'], items: [{ label: 'Place', color: '#123456' }] },
});
enhanced.setViewport([0, 0, 800], { animate: false });
enhanced.selectMarker('place', { duration: 250 });
enhanced.projectToScreen(-122.4, 37.7).visible satisfies boolean;
enhanced.overlayElement satisfies HTMLDivElement;
enhanced.stopAnimation();

enhanced.setFeatures({ motion: false, clustering: true, selectedMarkerRing: false });
enhanced.setFeatures({ motion: { duration: 180 }, scaleBar: undefined });
enhanced.setLayers({ landmarks: false, roadLabels: true });
enhanced.setControls({ zoom: false, reset: true });
// @ts-expect-error Feature switches must be typed, not arbitrary truthy strings.
enhanced.setFeatures({ clustering: 'yes' });
// @ts-expect-error Misspelled layer options are not silently accepted.
enhanced.setLayers({ park: false });

// Every documented overlay geometry must work through the shipped declaration.
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
