import { createMap } from '@kahwee/sf-map-svg';
import { renderMap } from '@kahwee/sf-map-svg/static';
import { interactiveCode, interactiveOptions, staticCode, staticOptions } from './layers-code.js';
import { mapCapabilities } from './site-capabilities.js';
import { loadSiteMapData, neighborhoodSources } from './site-map-data.js';
import { element, segmented, setCode } from './ui.js';

const $ = (id) => document.getElementById(id);

const layerInfo = [
  ['districtFills', 'District fills', 'district'],
  ['districtLines', 'District lines', 'district'],
  ['districtLabels', 'District numbers', 'district'],
  ['neighborhoodLines', 'Neighborhood lines', 'neighborhood'],
  ['neighborhoodLabels', 'Neighborhood names', 'neighborhood'],
  ['landmarks', 'Parks', 'other'],
  ['highways', 'Highways', 'other'],
  ['keyRoads', 'Key roads', 'other'],
  ['roadLabels', 'Road names', 'other'],
  ['bartStations', 'BART stations', 'other'],
];
const featureInfo = [
  ['labels', 'Show text labels'],
  ['layerTransitions', 'Fade layers and definitions'],
  ['districtMorph', 'Morph district years'],
  ['motion', 'Ease the camera'],
];

const state = {
  mode: 'neighborhoods',
  source: 'realtor',
  year: 2022,
  render: 'interactive',
  animation: mapCapabilities.animation,
  supportedFeatures: mapCapabilities,
  labels: true,
  features: { layerTransitions: true, districtMorph: true, motion: true },
  layers: {
    landmarks: true,
    highways: true,
    keyRoads: true,
    roadLabels: false,
    bartStations: true,
  },
};
/** District and neighborhood layers follow the view unless the reader overrides them. */
const modeLayers = (mode) => ({
  districtFills: mode === 'districts',
  districtLines: mode === 'districts',
  districtLabels: mode === 'districts',
  neighborhoodLines: mode === 'neighborhoods',
  neighborhoodLabels: mode === 'neighborhoods',
});
Object.assign(state.layers, modeLayers(state.mode));

let data;
let map;
const checkboxes = new Map();

function setDataReady(ready) {
  $('studio-map').setAttribute('aria-busy', String(!ready));
  for (const control of $('studio-controls').querySelectorAll('button, input')) {
    control.disabled = !ready;
  }
  if (ready) {
    checkboxes.get('neighborhoodLabels').disabled = state.render === 'static';
    for (const key of ['layerTransitions', 'districtMorph', 'motion'])
      checkboxes.get(key).disabled = state.render === 'static' || mapCapabilities[key] === false;
  }
  $('download').disabled = !ready;
  $('replay').disabled = !ready;
}

// ---------- Code ----------
function updateCode() {
  const interactive = state.render === 'interactive';
  $('code-title').textContent = interactive ? 'createMap · browser' : 'renderMap · anywhere';
  setCode($('studio-code'), interactive ? interactiveCode(state) : staticCode(state));
}

// ---------- Static rendering ----------
function staticNeighborhoods() {
  return data.neighborhoods[state.source].features.map((feature) => ({
    name: feature.properties.canonicalName,
    geometry: feature.geometry,
  }));
}
let sequence = 0;
function renderStatic(animation = state.animation) {
  return renderMap(
    { ...data.map, neighborhoods: staticNeighborhoods() },
    {
      ...staticOptions(state),
      animation,
      idPrefix: `studio-${++sequence}`,
      title: 'San Francisco map from the SF / SVG layers studio',
    },
  ).svg;
}
function showStatic() {
  if (!data) return;
  const holder = element('div', undefined, 'studio-static map-surface');
  holder.innerHTML = renderStatic();
  $('studio-map').replaceChildren(holder);
}

// ---------- Interactive map ----------
const mapStyle = {
  ink: 'var(--ink)',
  surface: 'var(--card)',
  accent: 'var(--accent)',
  border: 'var(--rule-strong)',
  focus: 'var(--accent)',
  font: 'var(--sans)',
};
function createInteractive() {
  const options = interactiveOptions(state);
  options.appearance.style = mapStyle;
  try {
    map = createMap(data, options);
  } catch (error) {
    // Released builds without the newest motion features still get the full studio.
    if (
      !(error instanceof TypeError) ||
      !/^Unknown feature: (layerTransitions|districtMorph)$/.test(error.message)
    )
      throw error;
    console.warn(error);
    map = createMap(data, { ...options, features: { motion: options.features.motion } });
    for (const key of ['layerTransitions', 'districtMorph']) {
      state.features[key] = false;
      checkboxes.get(key).disabled = true;
      checkboxes.get(key).checked = false;
    }
  }
  map.on('neighborhoodchange', (selection) => {
    $('studio-caption').textContent = selection.name
      ? `${selection.name} · ${neighborhoodSources.find((item) => item.id === selection.source).label} definition`
      : 'Select a neighborhood or district on the map to identify it.';
  });
  map.on('districtchange', (selection) => {
    $('studio-caption').textContent = selection.id
      ? `Supervisorial District ${selection.id} · ${selection.year} boundaries`
      : 'Select a neighborhood or district on the map to identify it.';
  });
  $('studio-map').replaceChildren(map.element);
  updateCode();
}

function apply(change) {
  change();
  updateCode();
  if (data && state.render === 'static') showStatic();
}

// ---------- Controls ----------
function buildControls() {
  const modeControl = segmented($('mode-control'), {
    label: 'View',
    options: [
      { value: 'basemap', label: 'Basemap' },
      { value: 'neighborhoods', label: 'Neighborhoods' },
      { value: 'districts', label: 'Districts' },
    ],
    value: state.mode,
    onChange: (mode) =>
      apply(() => {
        state.mode = mode;
        Object.assign(state.layers, modeLayers(mode));
        for (const [key, box] of checkboxes)
          if (key in state.layers) box.checked = state.layers[key];
        map?.setMode(mode);
        map?.configure({ layers: { ...state.layers } });
      }),
  });
  void modeControl;

  for (const source of neighborhoodSources) {
    const label = element('label', undefined, 'source-card');
    const input = element('input');
    input.type = 'radio';
    input.name = 'source';
    input.value = source.id;
    input.checked = source.id === state.source;
    input.addEventListener('change', () =>
      apply(() => {
        state.source = source.id;
        map?.setSource(source.id);
        if (state.mode !== 'neighborhoods' && state.render === 'interactive') {
          state.mode = 'neighborhoods';
          modeControl.set('neighborhoods');
          Object.assign(state.layers, modeLayers('neighborhoods'));
          for (const [key, box] of checkboxes)
            if (key in state.layers) box.checked = state.layers[key];
          map?.setMode('neighborhoods');
          map?.configure({ layers: { ...state.layers } });
        }
      }),
    );
    const text = element('span');
    text.append(
      element('strong', source.label),
      element('span', `${source.count} areas`, 'source-count'),
      element('span', source.detail, 'source-detail'),
    );
    label.append(input, text);
    $('source-control').append(label);
  }

  segmented($('year-control'), {
    label: 'District map year',
    options: [2002, 2012, 2022].map((value) => ({ value, label: String(value) })),
    value: state.year,
    onChange: (year) =>
      apply(() => {
        state.year = year;
        map?.setDistrictYear(year);
      }),
  });

  for (const [key, label] of layerInfo) {
    const row = element('label', undefined, 'check');
    const box = element('input');
    box.type = 'checkbox';
    box.checked = state.layers[key];
    box.addEventListener('change', () =>
      apply(() => {
        state.layers[key] = box.checked;
        map?.configure({ layers: { [key]: box.checked } });
      }),
    );
    checkboxes.set(key, box);
    row.append(box, element('span', label));
    $('layer-control').append(row);
  }

  for (const [key, label] of featureInfo) {
    const row = element('label', undefined, 'check');
    const box = element('input');
    box.type = 'checkbox';
    box.checked = key === 'labels' ? state.labels : state.features[key];
    box.addEventListener('change', () =>
      apply(() => {
        if (key === 'labels') {
          state.labels = box.checked;
          map?.setLabels(box.checked);
          return;
        }
        state.features[key] = box.checked;
        map?.configure({ features: { [key]: interactiveOptions(state).features[key] } });
      }),
    );
    if (mapCapabilities[key] === false) {
      state.features[key] = false;
      box.checked = false;
      box.disabled = true;
    }
    checkboxes.set(key, box);
    row.append(box, element('span', label));
    $('feature-control').append(row);
  }

  segmented($('render-control'), {
    label: 'Rendering',
    options: [
      { value: 'interactive', label: 'Interactive' },
      { value: 'static', label: 'Static SVG' },
    ],
    value: state.render,
    onChange: (render) => {
      state.render = render;
      $('replay').hidden = render !== 'static' || !state.animation;
      checkboxes.get('neighborhoodLabels').disabled = render === 'static';
      for (const key of ['layerTransitions', 'districtMorph', 'motion'])
        checkboxes.get(key).disabled = render === 'static' || mapCapabilities[key] === false;
      map?.destroy();
      map = undefined;
      if (data) {
        if (render === 'static') showStatic();
        else createInteractive();
      }
      updateCode();
    },
  });
  $('replay').addEventListener('click', showStatic);
  $('download').addEventListener('click', () => {
    if (!data) return;
    const blob = new Blob([renderStatic(false)], { type: 'image/svg+xml' });
    const link = element('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sf-map-${state.mode}-${state.year}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
}

buildControls();
setDataReady(false);
updateCode();
loadSiteMapData()
  .then((loaded) => {
    data = loaded;
    setDataReady(true);
    if (state.render === 'static') showStatic();
    else createInteractive();
  })
  .catch((error) => {
    data = undefined;
    map?.destroy();
    map = undefined;
    setDataReady(false);
    $('studio-map').setAttribute('aria-busy', 'false');
    const status = element('p', 'The map could not load.', 'stage-loading');
    status.setAttribute('role', 'status');
    $('studio-map').replaceChildren(status);
    console.error(error);
  });
