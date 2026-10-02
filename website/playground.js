import { createMap, renderMap } from '@kahwee/sf-map-svg';
import { enhanceDropdowns } from './dropdown.js';
import {
  colorNames,
  featureNames,
  initialState,
  interactiveOptions,
  layerNames,
  palettes,
  playgroundCode,
  readState,
  staticData,
  staticOptions,
} from './playground-model.js';
import { mapCapabilities } from './site-capabilities.js';
import { loadSiteMapData } from './site-map-data.js';
import { copyText, element, highlight } from './ui.js';

const $ = (id) => document.getElementById(id);
let state = initialState();
let linkError;
try {
  state = readState(location.hash);
} catch {
  linkError = 'That design link could not be read. Here is a fresh canvas.';
}
let data,
  map,
  ready = false,
  code = '',
  frame;
const history = [structuredClone(state)];
let historyIndex = 0;
const inputs = new Map();
const paletteButtons = new Map();

for (const palette of palettes) {
  const button = element('button', undefined, 'palette-card');
  button.type = 'button';
  button.setAttribute('aria-label', `${palette.name}: ${palette.mood}`);
  button.setAttribute('aria-pressed', String(state.palette === palette.id));
  const swatches = element('span', undefined, 'palette-swatches');
  swatches.setAttribute('aria-hidden', 'true');
  for (const color of [
    palette.colors.water,
    palette.colors.land,
    palette.colors.park,
    palette.colors.bart,
  ]) {
    const swatch = element('i');
    swatch.style.backgroundColor = color;
    swatches.append(swatch);
  }
  button.append(swatches, element('strong', palette.name));
  button.addEventListener('click', () => {
    state.palette = palette.id;
    state.colors = { ...palette.colors };
    state.theme = palette.theme;
    commit();
    syncControls();
  });
  paletteButtons.set(palette.id, button);
  $('palette-picker').append(button);
}
for (const [group, names] of [
  ['layers', layerNames],
  ['features', featureNames],
]) {
  for (const [key, name] of Object.entries(names)) {
    const label = element('label', undefined, 'toggle');
    const input = element('input');
    input.type = 'checkbox';
    input.id = `option-${key}`;
    label.append(element('span', name), input);
    $(`design-${group}`).append(label);
    inputs.set(key, input);
    input.addEventListener('change', () => {
      state[group][key] = input.checked;
      commit();
    });
  }
}
for (const [key, name] of Object.entries(colorNames)) {
  const label = element('label', undefined, 'color-field');
  const input = element('input');
  input.type = 'color';
  input.id = `ink-${key}`;
  input.setAttribute('aria-label', `${name} color`);
  const caption = element('span', name);
  caption.append(element('code', state.colors[key]));
  label.append(input, caption);
  $('design-colors').append(label);
  inputs.set(`color-${key}`, input);
  input.addEventListener('input', () => {
    state.colors[key] = input.value;
    caption.querySelector('code').textContent = input.value;
    schedulePaint();
  });
  input.addEventListener('change', commit);
}
for (const key of [
  'mode',
  'source',
  'year',
  'theme',
  'font',
  'weight',
  'size',
  'radius',
  'title',
  'labels',
  'pins',
  'route',
  'chrome',
  'animation',
]) {
  const input = $(`design-${key}`);
  const update = () => {
    state[key] =
      input.type === 'checkbox'
        ? input.checked
        : ['year', 'weight', 'size', 'radius'].includes(key)
          ? Number(input.value)
          : input.value;
    if (key === 'mode') {
      for (const name of Object.keys(layerNames))
        if (name.startsWith('district') || name.startsWith('neighborhood'))
          state.layers[name] = name.startsWith(
            state.mode === 'districts'
              ? 'district'
              : state.mode === 'neighborhoods'
                ? 'neighborhood'
                : 'none',
          );
    }
    syncControls();
    schedulePaint();
  };
  input.addEventListener('input', update);
  input.addEventListener('change', () => {
    update();
    commit();
  });
}
function syncControls() {
  for (const [key, button] of paletteButtons)
    button.setAttribute('aria-pressed', String(key === state.palette));
  for (const [key, input] of inputs) {
    if (key.startsWith('color-')) {
      input.value = state.colors[key.slice(6)];
      input.parentElement.querySelector('code').textContent = input.value;
    } else input.checked = state.layers[key] ?? state.features[key];
  }
  for (const key of [
    'mode',
    'source',
    'year',
    'theme',
    'font',
    'weight',
    'size',
    'radius',
    'title',
    'labels',
    'pins',
    'route',
    'chrome',
    'animation',
  ]) {
    const input = $(`design-${key}`);
    if (input.type === 'checkbox') input.checked = state[key];
    else input.value = state[key];
  }
  for (const key of ['weight', 'size', 'radius'])
    $(`${key}-value`).textContent = `${state[key]}${key === 'weight' ? '' : ' px'}`;
  const staticPreview = state.render === 'static';
  inputs.get('neighborhoodLabels').disabled = staticPreview;
  for (const key of Object.keys(featureNames))
    inputs.get(key).disabled = staticPreview || mapCapabilities[key] === false;
  for (const key of ['font', 'weight', 'size', 'radius', 'chrome'])
    $(`design-${key}`).disabled = staticPreview;
  $('design-animation').disabled = !staticPreview || !mapCapabilities.animation;
  $('design-title').disabled = !staticPreview;
  $('preview-interactive').setAttribute('aria-pressed', String(!staticPreview));
  $('preview-static').setAttribute('aria-pressed', String(staticPreview));
  $('design-undo').disabled = !ready || historyIndex === 0;
  $('design-redo').disabled = !ready || historyIndex === history.length - 1;
}
function commit() {
  if (!ready) return;
  const snapshot = structuredClone(state);
  if (JSON.stringify(snapshot) !== JSON.stringify(history[historyIndex])) {
    history.splice(historyIndex + 1);
    history.push(snapshot);
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
  }
  syncControls();
  schedulePaint();
}
function schedulePaint() {
  if (!ready || frame) return;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    paint();
  });
}
function mountBrowser(options) {
  if (!map) {
    map = createMap(data, options);
    map.on('districtchange', ({ id, year }) => {
      $('design-selection').textContent =
        id === null ? 'District selection cleared.' : `District ${id} · ${year} boundaries`;
    });
    map.on('neighborhoodchange', ({ name, source }) => {
      $('design-selection').textContent = name
        ? `${name} · ${source}`
        : 'Neighborhood selection cleared.';
    });
    map.on('markerchange', ({ marker }) => {
      $('design-selection').textContent = marker ? marker.label : 'Pin selection cleared.';
    });
  } else if (mapCapabilities.runtimeAppearance) {
    const {
      appearance,
      mode,
      source,
      year,
      labels,
      layers,
      features,
      controls,
      markers,
      overlays,
    } = options;
    map.configure({ appearance, mode, source, year, labels, layers, features, controls });
    map.setMarkers(markers);
    map.setOverlays(overlays);
  } else {
    const viewport = map.camera.get();
    const marker = map.getSelectedMarker(),
      district = map.getSelectedDistrict(),
      neighborhood = map.getSelectedNeighborhood();
    map.destroy();
    map = undefined;
    mountBrowser(options);
    map.camera.set(viewport, { animate: false });
    if (marker) map.selectMarker(marker.id, { fit: false });
    if (district) map.selectDistrict(district.id, { fit: false });
    if (neighborhood && neighborhood.source === state.source)
      map.selectNeighborhood(neighborhood.id, { fit: false });
  }
}
function paint() {
  try {
    $('design-map').dataset.updateStrategy = mapCapabilities.runtimeAppearance
      ? 'configure'
      : 'reconstruct';
    const options = interactiveOptions(state, mapCapabilities);
    mountBrowser(options);
    if (state.render === 'static') {
      $('design-map').innerHTML = renderMap(
        staticData(data, state.source),
        staticOptions(state, mapCapabilities),
      ).svg;
      $('design-selection').textContent = 'Self-contained SVG · full city extent';
    } else if ($('design-map').firstElementChild !== map.element) {
      $('design-map').replaceChildren(map.element);
      $('design-selection').textContent = state.pins
        ? 'Choose a pin or explore the map.'
        : 'Click an area to explore. Drag to pan.';
    }
    enhanceDropdowns(map.element);
    $('design-map').querySelector('svg')?.setAttribute('data-design-preview', '');
    $('edition-name').textContent = palettes.find((palette) => palette.id === state.palette).name;
    $('edition-year').textContent = state.year;
    code = playgroundCode(state, mapCapabilities);
    $('design-code').innerHTML = highlight(code);
    $('live-state').textContent = '● All changes live';
    $('design-map').setAttribute('aria-busy', 'false');
    const resolved = map.getResolvedConfiguration?.();
    const available = map.getCapabilities?.();
    $('design-inspector').replaceChildren(
      ...Object.entries(layerNames).map(([key, name]) => {
        const row = element('div', undefined, 'inspector-row');
        const status =
          state.render === 'static' && key === 'neighborhoodLabels'
            ? 'browser only'
            : available?.layers[key] === false
              ? 'no data'
              : (resolved?.layers[key] ??
                  (state.layers[key] && (!key.endsWith('Labels') || state.labels)))
                ? 'on · data supplied'
                : 'off';
        row.append(element('span', name), element('span', status));
        return row;
      }),
    );
  } catch (error) {
    $('live-state').textContent = 'Could not apply design';
    $('design-selection').textContent = error.message;
  }
}
for (const render of ['interactive', 'static'])
  $(`preview-${render}`).addEventListener('click', () => {
    if (ready) {
      state.render = render;
      commit();
    }
  });
$('design-undo').addEventListener('click', () => {
  if (historyIndex > 0) {
    state = structuredClone(history[--historyIndex]);
    syncControls();
    schedulePaint();
  }
});
$('design-redo').addEventListener('click', () => {
  if (historyIndex < history.length - 1) {
    state = structuredClone(history[++historyIndex]);
    syncControls();
    schedulePaint();
  }
});
$('design-reset').addEventListener('click', () => {
  state = initialState();
  map?.camera.reset({ animate: false });
  commit();
});
$('design-copy').addEventListener('click', (event) => copyText(event.currentTarget, code));
$('design-share').addEventListener('click', (event) => {
  const url = new URL(location.href);
  url.hash = `design=${encodeURIComponent(JSON.stringify(state))}`;
  copyText(event.currentTarget, url.href);
});
let exportData;
async function loadExportData() {
  exportData ??= fetch('./data/export-map.json')
    .then((response) => {
      if (!response.ok) throw new Error('Export geography could not load.');
      return response.json();
    })
    .catch((error) => {
      exportData = undefined;
      throw error;
    });
  return exportData;
}
$('design-download').addEventListener('click', async () => {
  if (!ready) return;
  const design = structuredClone(state);
  const button = $('design-download');
  const original = [...button.childNodes];
  button.disabled = true;
  button.textContent = 'Preparing SVG…';
  try {
    const fullData = await loadExportData();
    const { svg } = renderMap(
      staticData(fullData, design.source),
      staticOptions(design, mapCapabilities),
    );
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = element('a');
    link.href = url;
    link.download = `sf-${design.palette}-${design.year}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    $('design-selection').textContent = 'Export could not load its geography. Try exporting again.';
  } finally {
    button.disabled = false;
    button.replaceChildren(...original);
  }
});
window.addEventListener('hashchange', () => {
  try {
    state = readState(location.hash);
    commit();
  } catch {
    $('design-selection').textContent = 'This design link could not be read.';
  }
});
window.addEventListener('pagehide', () => {
  if (frame) cancelAnimationFrame(frame);
  frame = undefined;
  map?.destroy();
  map = undefined;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && ready) {
    paint();
  }
});
syncControls();
try {
  data = await loadSiteMapData();
  ready = true;
  $('design-fields').disabled = false;
  for (const key of [
    'preview-interactive',
    'preview-static',
    'design-reset',
    'design-share',
    'design-download',
    'design-copy',
  ])
    $(key).disabled = false;
  syncControls();
  paint();
  if (linkError) $('design-selection').textContent = linkError;
  if (!mapCapabilities.runtimeAppearance)
    $('api-version').textContent +=
      ' Live styling uses compatibility mode; copied code matches this package version.';
} catch {
  $('live-state').textContent = 'Geography unavailable';
  $('design-map').setAttribute('aria-busy', 'false');
  const message = element('p', 'The map could not load. Reload to try again.', 'stage-loading');
  const retry = element('button', 'Reload playground', 'button secondary small');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  message.append(document.createElement('br'), retry);
  $('design-map').replaceChildren(message);
}
