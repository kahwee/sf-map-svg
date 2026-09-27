import { guideMapData } from '../dist/src/guide-data.js';
import { createMap } from '../dist/src/map.js';
import { guideOptions } from '../dist/src/presets.js';

const markers = Array.from({ length: 36 }, (_, i) => ({
  id: `sample-${i + 1}`,
  label: `Sample marker ${i + 1}`,
  lng: -122.4269 + (i % 3) * 0.002,
  lat: 37.7596 + (i % 2) * 0.002,
}));
const map = createMap(guideMapData, {
  features: {
    motion: { duration: 450 },
    markerEntrance: { duration: 500, stagger: 40 },
    clustering: true,
    selectedMarkerRing: { color: '#163d61' },
    northArrow: true,
    scaleBar: true,
  },
  attribution: 'compact',
  legend: { items: [{ label: 'Places', color: '#245b61' }] },
  mode: 'neighborhoods',
  source: 'realtor',
  markers,
  appearance: { theme: 'districts', labelSize: { min: 12, max: 14 } },
  layers: { ...guideOptions.layers },
});
document.querySelector('#map').append(map.element);
const output = document.querySelector('#selection');
map.on('neighborhoodchange', (detail) => {
  output.textContent = detail.id
    ? `${detail.name} · ${detail.source} · ${detail.id}`
    : 'Selection cleared';
});
map.on('markerchange', (detail) => {
  output.textContent = detail.marker?.label ?? 'Marker selection cleared';
});
document.querySelector('#fit').addEventListener('click', () =>
  map.camera.fit(
    {
      type: 'MultiPoint',
      coordinates: markers.map((marker) => [marker.lng, marker.lat]),
    },
    { padding: { top: 36, right: 24, bottom: 70, left: 24 } },
  ),
);
let saved = map.camera.get();
document.querySelector('#save').addEventListener('click', () => {
  saved = map.camera.get();
});
document.querySelector('#restore').addEventListener('click', () => map.camera.set(saved));
document.querySelector('#clear').addEventListener('click', () => {
  map.selectNeighborhood(null);
  map.selectMarker(null);
});

// Feature switches update the existing map, preserving camera and selection.
const switches = document.createElement('fieldset');
const heading = document.createElement('legend');
heading.textContent = 'Optional map features';
switches.append(heading);
for (const [feature, title] of [
  ['motion', 'Smooth camera'],
  ['markerEntrance', 'Pin entrances'],
  ['clustering', 'Cluster places'],
  ['selectedMarkerRing', 'Selection ring'],
  ['northArrow', 'North arrow'],
  ['scaleBar', 'Scale bar'],
]) {
  const label = document.createElement('label');
  label.style.cssText = 'display:inline-flex;gap:6px;margin:8px';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  input.addEventListener('change', () => map.configure({ features: { [feature]: input.checked } }));
  label.append(input, document.createTextNode(title));
  switches.append(label);
}
document.querySelector('#map').before(switches);
