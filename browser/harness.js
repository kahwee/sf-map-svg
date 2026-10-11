import { fullMapData } from '../src/full-data.ts';
import { createMap } from '../src/map.ts';

const host = document.querySelector('#host');
const markers = [
  { id: 'one', label: 'First place', lng: -122.4269, lat: 37.7596 },
  { id: 'two', label: 'Second place', lng: -122.4269, lat: 37.7596 },
  { id: 'park', label: 'Park', lng: -122.4687, lat: 37.7704 },
];
const settle = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** Deterministic 50-column city grid, not imported place data. */
function grid(count, revision = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `pin-${index}`,
    label: `Place ${index} revision ${revision}`,
    lng: -122.505 + (index % 50) * 0.0024,
    lat: 37.715 + Math.floor(index / 50) * 0.002,
  }));
}

function mount(options = {}) {
  window.map?.destroy();
  host.replaceChildren();
  window.map = createMap(fullMapData, { markers, features: { clustering: true }, ...options });
  host.append(window.map.element);
  return window.map;
}

window.harness = { mount, markers, grid, settle };
