import { createMap, renderMap } from '../dist/src/api.js';
import { fullMapData } from '../dist/src/full-data.js';

const map = createMap(fullMapData, {
  mode: 'districts',
  year: 2002,
  layers: { bartStations: true, landmarks: true },
  features: { motion: true, districtMorph: { duration: 1000 } },
  appearance: { theme: 'districts' },
});
document.querySelector('#map').append(map.element);
const status = document.querySelector('#status');
let year = 2002;
let timers = [];
function selectYear(y) {
  year = y;
  map.setMode('districts');
  map.setDistrictYear(y);
  map.camera.reset({ animate: false });
  status.textContent = `${y} supervisorial districts`;
  document.querySelectorAll('[data-year]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.year) === y));
  });
}
function clear() {
  timers.forEach(clearTimeout);
  timers = [];
  document.querySelector('#preview').hidden = true;
  document.querySelector('#map').hidden = false;
}
function svg() {
  return renderMap(fullMapData, {
    year,
    landmarks: true,
    bartStations: true,
    title: `San Francisco districts ${year}`,
  }).svg;
}
document.querySelectorAll('[data-year]').forEach((button) => {
  button.onclick = () => {
    clear();
    selectYear(Number(button.dataset.year));
  };
});
document.querySelector('#neighborhood').onclick = () => {
  clear();
  map.setMode('neighborhoods');
  map.selectNeighborhood('Inner Mission', { fit: true, animate: true });
  status.textContent = 'Inner Mission · SFAR realtor neighborhood';
};
document.querySelector('#download').onclick = () => {
  const url = URL.createObjectURL(new Blob([svg()], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sf-districts-${year}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelector('#play').onclick = () => {
  clear();
  selectYear(2002);
  timers.push(
    setTimeout(() => selectYear(2012), 4000),
    setTimeout(() => selectYear(2022), 8000),
    setTimeout(() => {
      map.setMode('neighborhoods');
      map.selectNeighborhood('Inner Mission', { fit: true, animate: true });
      status.textContent = 'Inner Mission · SFAR realtor neighborhood';
    }, 12000),
    setTimeout(() => {
      const p = document.querySelector('#preview');
      p.innerHTML = svg();
      p.hidden = false;
      document.querySelector('#map').hidden = true;
      status.textContent = 'Self-contained SVG export · 2022';
    }, 16000),
    setTimeout(() => {
      status.textContent = 'Offline SVG maps · no runtime dependencies';
    }, 20000),
  );
};
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    clear();
    map.destroy();
  }
});
