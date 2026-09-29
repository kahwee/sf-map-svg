import { createMap } from '@kahwee/sf-map-svg';
import { renderMap } from '@kahwee/sf-map-svg/static';
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

// ---------- Code ----------
const literal = (value) => (typeof value === 'string' ? `'${value}'` : String(value));
const objectCode = (entries) =>
  `{ ${entries.map(([key, value]) => `${key}: ${literal(value)}`).join(', ')} }`;

function interactiveCode() {
  const defaults = {
    ...modeLayers(state.mode),
    landmarks: true,
    highways: true,
    keyRoads: true,
    roadLabels: true,
    bartStations: true,
  };
  const layers = Object.entries(state.layers).filter(([key, value]) => defaults[key] !== value);
  const features = Object.entries(state.features).filter(([, on]) => on);
  const lines = [];
  if (state.mode !== 'neighborhoods') lines.push(`  mode: '${state.mode}',`);
  if (state.source !== 'realtor') lines.push(`  source: '${state.source}',`);
  if (state.year !== 2022) lines.push(`  year: ${state.year},`);
  if (!state.labels) lines.push('  labels: false,');
  if (layers.length) lines.push(`  layers: ${objectCode(layers)},`);
  if (features.length) lines.push(`  features: ${objectCode(features)},`);
  return `import { createMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const map = createMap(fullMapData${lines.length ? `, {\n${lines.join('\n')}\n}` : ''});
document.querySelector('#map').append(map.element);`;
}

function staticOptions() {
  return {
    year: state.year,
    districtFills: state.layers.districtFills,
    districtLines: state.layers.districtLines,
    districtLabels: state.layers.districtLabels,
    neighborhoodLines: state.layers.neighborhoodLines,
    landmarks: state.layers.landmarks,
    highways: state.layers.highways,
    keyRoads: state.layers.keyRoads,
    roadLabels: state.layers.roadLabels,
    bartStations: state.layers.bartStations,
    labels: state.labels,
  };
}

function staticCode() {
  const options = Object.entries(staticOptions()).filter(([key, value]) => {
    const defaults = {
      year: 2022,
      districtFills: true,
      districtLines: true,
      districtLabels: true,
      neighborhoodLines: false,
      landmarks: false,
      highways: false,
      keyRoads: false,
      roadLabels: state.layers.keyRoads,
      bartStations: false,
      labels: true,
    };
    return defaults[key] !== value;
  });
  const lines = [
    ...options.map(([key, value]) => `  ${key}: ${literal(value)},`),
    '  animation: true,',
  ];
  const needsSource = state.layers.neighborhoodLines && state.source !== 'realtor';
  const sourceLines = needsSource
    ? `import { neighborhoodCollections } from '@kahwee/sf-map-svg/data';

// Static maps draw one neighborhood list; the default is SFAR realtor.
const neighborhoods = neighborhoodCollections['${state.source}'].features.map((feature) => ({
  name: feature.properties.canonicalName,
  geometry: feature.geometry,
}));
`
    : '';
  return `import { renderMap } from '@kahwee/sf-map-svg/static';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';
${sourceLines}
const { svg } = renderMap(${needsSource ? '{ ...staticMapData, neighborhoods }' : 'staticMapData'}, {
${lines.join('\n')}
});`;
}

function updateCode() {
  const interactive = state.render === 'interactive';
  $('code-title').textContent = interactive ? 'createMap · browser' : 'renderMap · anywhere';
  setCode($('studio-code'), interactive ? interactiveCode() : staticCode());
}

// ---------- Static rendering ----------
function staticNeighborhoods() {
  return data.neighborhoods[state.source].features.map((feature) => ({
    name: feature.properties.canonicalName,
    geometry: feature.geometry,
  }));
}
let sequence = 0;
function renderStatic(animation = true) {
  return renderMap(
    { ...data.map, neighborhoods: staticNeighborhoods() },
    {
      ...staticOptions(),
      animation,
      idPrefix: `studio-${++sequence}`,
      title: 'San Francisco map from the SF / SVG layers studio',
    },
  ).svg;
}
function showStatic() {
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
  const features = {
    layerTransitions: state.features.layerTransitions && { duration: 480 },
    districtMorph: state.features.districtMorph && { duration: 1300 },
    motion: state.features.motion && { duration: 600 },
  };
  const options = {
    mode: state.mode,
    source: state.source,
    year: state.year,
    labels: state.labels,
    layers: { ...state.layers },
    attribution: 'compact',
    controls: { labels: false, legend: false, neighborhoodPicker: false, markerPicker: false },
    appearance: { theme: 'districts', style: mapStyle },
  };
  try {
    map = createMap(data, { ...options, features });
  } catch (error) {
    // Released builds without the newest motion features still get the full studio.
    console.warn(error);
    map = createMap(data, { ...options, features: { motion: features.motion } });
    for (const key of ['layerTransitions', 'districtMorph']) {
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
}

function apply(change) {
  change();
  updateCode();
  if (state.render === 'static') showStatic();
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
        map?.configure({ features: { [key]: box.checked } });
      }),
    );
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
      $('replay').hidden = render !== 'static';
      map?.destroy();
      map = undefined;
      if (render === 'static') showStatic();
      else createInteractive();
      updateCode();
    },
  });
  $('replay').addEventListener('click', showStatic);
  $('download').addEventListener('click', () => {
    const blob = new Blob([renderStatic(false)], { type: 'image/svg+xml' });
    const link = element('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sf-map-${state.mode}-${state.year}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
}

buildControls();
updateCode();
loadSiteMapData()
  .then((loaded) => {
    data = loaded;
    createInteractive();
  })
  .catch((error) => {
    $('studio-map').querySelector('.stage-loading').textContent = 'The map could not load.';
    console.error(error);
  });
