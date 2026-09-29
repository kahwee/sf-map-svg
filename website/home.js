import { createMap } from '@kahwee/sf-map-svg';
import { prefersReducedMotion, whenVisible } from './motion-kit.js';
import { mountPlates } from './plates.js';
import { loadSiteMapData, neighborhoodSources } from './site-map-data.js';
import { copyText, enhanceCode, segmented } from './ui.js';

mountPlates();
enhanceCode();
for (const button of document.querySelectorAll('[data-copy]'))
  button.addEventListener('click', () => copyText(button, button.dataset.copy));

// ---------- How the map is made: each step drives the real controller ----------

const host = document.getElementById('making-map');
const badge = document.getElementById('stage-badge');
const steps = [...document.querySelectorAll('.step')];
const years = [2002, 2012, 2022];
const pins = [
  { id: 'ferry', label: 'Ferry Building', lng: -122.3937, lat: 37.7955 },
  { id: 'dolores', label: 'Dolores Park', lng: -122.4269, lat: 37.7596 },
  { id: 'twin-peaks', label: 'Twin Peaks', lng: -122.4476, lat: 37.7518 },
  { id: 'ocean-beach', label: 'Ocean Beach', lng: -122.5104, lat: 37.7598 },
];
const quiet = {
  landmarks: false,
  highways: false,
  keyRoads: false,
  roadLabels: false,
  bartStations: false,
};
const lines = ['landmarks', 'highways', 'keyRoads', 'bartStations'];
/** The controller's chrome picks up the site's theme tokens. */
const mapStyle = {
  ink: 'var(--ink)',
  surface: 'var(--card)',
  accent: 'var(--accent)',
  border: 'var(--rule-strong)',
  focus: 'var(--accent)',
  font: 'var(--sans)',
};

let map;
let scene;
let timers = [];
let year = 2022;
let source = 'realtor';
let yearControl;
let sourceControl;
/** Autoplay pauses once the reader picks a year or source themselves. */
let autoplay = !prefersReducedMotion();

const later = (ms, action) => timers.push(setTimeout(action, ms));
const clearTimers = () => {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
};
const setBadge = (text) => {
  badge.textContent = text;
};

function showYear(next, animate = true) {
  year = next;
  map.setDistrictYear(next, { animate });
  yearControl?.set(next);
  setBadge(`${next} supervisorial districts`);
}
function showSource(next) {
  source = next;
  map.setSource(next);
  sourceControl?.set(next);
  const info = neighborhoodSources.find((item) => item.id === next);
  setBadge(`${info.label} · ${info.count} areas`);
}
/** Ease the camera to a neighborhood-scale view centered on a pin, and select it. */
function focusOn(id, size = 260) {
  const pin = pins.find((item) => item.id === id);
  const canvas = map.element.querySelector('svg');
  const width = canvas?.getBoundingClientRect().width;
  if (!pin || !width) return;
  const [x, y, span] = map.camera.get();
  const screen = map.projectToScreen(pin.lng, pin.lat);
  const px = x + (screen.x * span) / width;
  const py = y + (screen.y * span) / width;
  map.selectMarker(id);
  map.camera.set([px - size / 2, py - size / 2, size], { animate: true });
}
function cycle(values, current, show, every) {
  if (!autoplay) return;
  const next = values[(values.indexOf(current) + 1) % values.length];
  later(every, () => {
    show(next);
    cycle(values, next, show, every);
  });
}

const scenes = {
  coast() {
    map.setMarkers([]);
    map.setMode('basemap');
    map.configure({ layers: quiet });
    map.camera.reset();
    setBadge('The coast');
  },
  districts() {
    map.setMarkers([]);
    map.configure({ layers: quiet });
    map.setMode('districts');
    if (year !== 2022) showYear(2022, false);
    map.camera.reset();
    setBadge('2022 supervisorial districts');
  },
  years() {
    map.setMarkers([]);
    map.configure({ layers: quiet });
    map.setMode('districts');
    map.camera.reset();
    setBadge(`${year} supervisorial districts`);
    cycle(years, year, showYear, 2600);
  },
  neighborhoods() {
    map.setMarkers([]);
    map.configure({ layers: quiet });
    map.setMode('neighborhoods');
    map.camera.reset();
    showSource(source);
    cycle(
      neighborhoodSources.map((item) => item.id),
      source,
      showSource,
      2800,
    );
  },
  lines() {
    map.setMarkers([]);
    map.setMode('basemap');
    map.camera.reset();
    setBadge('Parks, roads and BART');
    map.configure({ layers: quiet });
    lines.forEach((key, index) => {
      later(250 + index * 420, () => map.configure({ layers: { [key]: true } }));
    });
  },
  markers() {
    map.setMode('basemap');
    map.configure({
      layers: { landmarks: true, highways: true, keyRoads: true, bartStations: true },
    });
    map.camera.reset();
    map.setMarkers(pins);
    setBadge('Your data');
    if (!autoplay) return;
    const tour = ['ferry', 'dolores', 'twin-peaks', null];
    tour.forEach((id, index) => {
      later(900 + index * 2400, () => {
        if (id) focusOn(id);
        else {
          map.selectMarker(null);
          map.camera.reset();
        }
      });
    });
  },
};

function activate(step) {
  const name = step.dataset.step;
  for (const item of steps) item.classList.toggle('is-active', item === step);
  if (!map || name === scene) return;
  scene = name;
  clearTimers();
  scenes[name]();
}

function buildControls() {
  yearControl = segmented(document.querySelector('[data-years]'), {
    label: 'District map year',
    options: years.map((value) => ({ value, label: String(value) })),
    value: year,
    onChange: (value) => {
      autoplay = false;
      clearTimers();
      activate(steps.find((step) => step.dataset.step === 'years'));
      showYear(value);
    },
  });
  sourceControl = segmented(document.querySelector('[data-sources]'), {
    label: 'Neighborhood definition',
    options: neighborhoodSources.map((item) => ({ value: item.id, label: item.short })),
    value: source,
    onChange: (value) => {
      autoplay = false;
      clearTimers();
      activate(steps.find((step) => step.dataset.step === 'neighborhoods'));
      showSource(value);
    },
  });
}

async function start() {
  try {
    const data = await loadSiteMapData();
    map = createMap(data, {
      mode: 'basemap',
      attribution: 'compact',
      layers: quiet,
      // The story drives the camera, so the stage hides the map's own controls.
      controls: {
        zoom: false,
        pan: false,
        reset: false,
        labels: false,
        touch: false,
        legend: false,
        neighborhoodPicker: false,
        markerPicker: false,
        help: false,
      },
      appearance: { theme: 'districts', style: mapStyle },
      features: {
        motion: { duration: 900 },
        markerEntrance: { duration: 520, stagger: 110 },
        selectedMarkerRing: true,
        layerTransitions: { duration: 560 },
        districtMorph: { duration: 1500 },
      },
    });
  } catch (error) {
    // The site may be built against a release without the newest motion features.
    try {
      const data = await loadSiteMapData();
      map = createMap(data, { mode: 'basemap', attribution: 'compact', layers: quiet });
      console.warn('Map motion features are unavailable in this build.', error);
    } catch (fatal) {
      host.querySelector('.stage-loading').textContent = 'The map could not load.';
      console.error(fatal);
      return;
    }
  }
  host.replaceChildren(map.element);
  buildControls();
  const current = steps.find((step) => step.classList.contains('is-active')) ?? steps[0];
  activate(current);
}

if (host) {
  // Steps light up as their middle crosses the center of the viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) activate(entry.target);
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  for (const step of steps) observer.observe(step);
  whenVisible(document.getElementById('making'), start, '600px');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimers();
    else if (scene) {
      const name = scene;
      scene = undefined;
      activate(steps.find((step) => step.dataset.step === name));
    }
  });
}
