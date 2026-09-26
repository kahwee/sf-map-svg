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
