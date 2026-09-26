import { createInteractiveSFMap } from '../dist/src/interactive.js';

const markers = Array.from({ length: 36 }, (_, i) => ({
  id: `sample-${i + 1}`,
  label: `Sample marker ${i + 1}`,
  lng: -122.4269 + (i % 3) * 0.002,
  lat: 37.7596 + (i % 2) * 0.002,
}));
const map = createInteractiveSFMap({
  mode: 'neighborhoods',
  source: 'analysis',
  markers,
  theme: 'districts',
  labelSize: { min: 12, max: 14 },
  layers: { districtFills: true, districtLines: false, districtLabels: false },
});
document.querySelector('#map').append(map);
const output = document.querySelector('#selection');
map.addEventListener('neighborhoodchange', ({ detail }) => {
  output.textContent = detail.id
    ? `${detail.name} · ${detail.source} · ${detail.id}`
    : 'Selection cleared';
});
map.addEventListener('markerchange', ({ detail }) => {
  output.textContent = detail.marker?.label ?? 'Marker selection cleared';
});
document.querySelector('#fit').addEventListener('click', () =>
  map.fitGeometry(
    {
      type: 'MultiPoint',
      coordinates: markers.map((marker) => [marker.lng, marker.lat]),
    },
    { top: 36, right: 24, bottom: 70, left: 24 },
  ),
);
let saved = map.getViewport();
document.querySelector('#save').addEventListener('click', () => {
  saved = map.getViewport();
});
document.querySelector('#restore').addEventListener('click', () => map.setViewport(saved));
document.querySelector('#clear').addEventListener('click', () => {
  map.selectNeighborhood(null);
  map.selectMarker(null);
});
