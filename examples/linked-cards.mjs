import { bindMapCards } from '../dist/src/cards.js';
import { guideMapData } from '../dist/src/guide-data.js';
import { createGuideController } from '../dist/src/guide-map.js';
import { mapPalettes } from '../dist/src/presets.js';

const places = guideMapData.map.landmarks
  .filter((place) => ['Golden Gate Park', 'Presidio', 'McLaren Park'].includes(place.name))
  .map((place, index) => ({
    id: `park-${index}`,
    label: place.name,
    lng: place.label[0],
    lat: place.label[1],
  }));
const map = createGuideController({
  mode: 'basemap',
  attribution: 'compact',
  markers: places,
  layers: { districtLabels: false, roadLabels: false, bartStations: false },
  controls: {
    markerPicker: false,
    neighborhoodPicker: false,
    legend: false,
    help: false,
  },
});
document.querySelector('#map').append(map.element);
const cards = document.querySelector('#place-cards');
let binding;
function palette(name) {
  const tokens = mapPalettes[name];
  document.documentElement.dataset.palette = name;
  map.configure({
    appearance: {
      colors: tokens.colors,
      style: {
        ink: tokens.colors.label,
        surface: tokens.colors.land,
        accent: tokens.markerColor,
        border: tokens.colors.neighborhood,
        focus: tokens.selectedMarkerRingColor,
      },
      labelStyle: { haloColor: tokens.haloColor },
      markerColor: tokens.markerColor,
      selectedMarkerColor: tokens.selectedMarkerColor,
    },
    features: { selectedMarkerRing: { color: tokens.selectedMarkerRingColor } },
  });
  binding?.destroy();
  binding = bindMapCards(map, cards, {
    markers: places,
    highlightColor: tokens.selectedMarkerRingColor,
  });
  for (const button of document.querySelectorAll('[data-palette-choice]'))
    button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === name));
}
for (const button of document.querySelectorAll('[data-palette-choice]'))
  button.addEventListener('click', () => palette(button.dataset.paletteChoice));
palette(matchMedia('(prefers-color-scheme: dark)').matches ? 'nightForest' : 'warmPaper');
map.on('markerchange', ({ marker }) => {
  document.querySelector('#selection').textContent = marker
    ? `${marker.label} selected`
    : 'Choose a place on the map or in the list.';
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    binding.destroy();
    map.destroy();
  }
});
