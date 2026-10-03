import {
  createMap,
  type MapController,
  type MapData,
  type MapOptions,
  renderMap,
} from '@kahwee/sf-map-svg';
import { enhanceDropdowns } from './dropdown.js';
import {
  type CodeLanguage,
  colorNames,
  designHash,
  featureNames,
  initialState,
  interactiveOptions,
  keys,
  layerNames,
  type PlaygroundState,
  paletteName,
  palettes,
  playgroundCode,
  readState,
  setMode,
  staticData,
  staticOptions,
} from './playground-model.ts';
import { mapCapabilities } from './site-capabilities.js';
import { loadSiteMapData } from './site-map-data.js';
import { copyText, element, highlight } from './ui.js';

function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing playground element: ${id}`);
  return node;
}
function control(id: string): HTMLInputElement | HTMLSelectElement {
  const node = $(id);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement))
    throw new Error(`Expected a form control: ${id}`);
  return node;
}
function button(id: string): HTMLButtonElement {
  const node = $(id);
  if (!(node instanceof HTMLButtonElement)) throw new Error(`Expected a button: ${id}`);
  return node;
}
function checkbox(node: HTMLInputElement | HTMLSelectElement): node is HTMLInputElement {
  return node instanceof HTMLInputElement && node.type === 'checkbox';
}
const controlKeys = [
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
] as const;
let language: CodeLanguage = 'javascript';
let state = initialState();
let linkError: string | undefined;
try {
  state = readState(location.hash);
} catch {
  linkError = 'That design link could not be read. Here is a fresh canvas.';
}
let data: MapData;
let map: MapController | undefined;
let browserView:
  | {
      viewport: ReturnType<MapController['camera']['get']>;
      marker: ReturnType<MapController['getSelectedMarker']>;
      district: ReturnType<MapController['getSelectedDistrict']>;
      neighborhood: ReturnType<MapController['getSelectedNeighborhood']>;
    }
  | undefined;
function rememberBrowserView(controller: MapController) {
  browserView = {
    viewport: controller.camera.get(),
    marker: controller.getSelectedMarker(),
    district: controller.getSelectedDistrict(),
    neighborhood: controller.getSelectedNeighborhood(),
  };
}
function restoreBrowserView(controller: MapController) {
  if (!browserView) return;
  const { viewport, marker, district, neighborhood } = browserView;
  controller.camera.set(viewport, { animate: false });
  if (marker) controller.selectMarker(marker.id, { fit: false });
  if (district) controller.selectDistrict(district.id, { fit: false });
  if (neighborhood?.source === state.source)
    controller.selectNeighborhood(neighborhood.id, { fit: false });
}
let lastOptions: MapOptions | undefined;
let ready = false,
  code = '';
let frame: number | undefined;
let pendingCommit = false;
let appliedState = structuredClone(state);
const history: PlaygroundState[] = [structuredClone(state)];
let historyIndex = 0;
const inputs = new Map<string, HTMLInputElement>();
const synchronizeInputs: (() => void)[] = [];
const paletteButtons = new Map<string, HTMLButtonElement>();
function requiredInput(key: string): HTMLInputElement {
  const input = inputs.get(key);
  if (!input) throw new Error(`Missing option control: ${key}`);
  return input;
}

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
function addSwitches<K extends string>(
  group: 'layers' | 'features',
  names: Record<K, string>,
  getValues: () => Record<K, boolean>,
) {
  for (const key of keys(names)) {
    const label = element('label', undefined, 'toggle');
    const input = element('input');
    input.type = 'checkbox';
    input.id = `option-${key}`;
    label.append(element('span', names[key]), input);
    $(`design-${group}`).append(label);
    inputs.set(key, input);
    synchronizeInputs.push(() => {
      input.checked = getValues()[key];
    });
    input.addEventListener('change', () => {
      getValues()[key] = input.checked;
      if (group === 'layers') Object.assign(state.layerOverrides, { [key]: input.checked });
      commit();
    });
  }
}
addSwitches('layers', layerNames, () => state.layers);
addSwitches('features', featureNames, () => state.features);
for (const key of keys(colorNames)) {
  const name = colorNames[key];
  const label = element('label', undefined, 'color-field');
  const input = element('input');
  input.type = 'color';
  input.id = `ink-${key}`;
  input.setAttribute('aria-label', `${name} color`);
  const caption = element('span', name);
  const colorValue = element('code', state.colors[key]);
  caption.append(colorValue);
  label.append(input, caption);
  $('design-colors').append(label);
  inputs.set(`color-${key}`, input);
  synchronizeInputs.push(() => {
    input.value = state.colors[key];
    colorValue.textContent = input.value;
  });
  input.addEventListener('input', () => {
    state.colors[key] = input.value;
    colorValue.textContent = input.value;
    schedulePaint();
  });
  input.addEventListener('change', commit);
}
for (const key of controlKeys) {
  const input = control(`design-${key}`);
  const update = () => {
    const value = checkbox(input)
      ? input.checked
      : ['year', 'weight', 'size', 'radius'].includes(key)
        ? Number(input.value)
        : input.value;
    // Use the same validated boundary as share links for all form values.
    const next = readState(`#${designHash({ ...state, [key]: value })}`);
    if (key === 'mode') setMode(next, next.mode);
    state = next;
    syncControls();
    schedulePaint();
  };
  input.addEventListener('input', update);
  input.addEventListener('change', () => {
    update();
    commit();
  });
}
control('design-language').addEventListener('change', () => {
  language = control('design-language').value === 'typescript' ? 'typescript' : 'javascript';
  if (ready) updateCode();
});
function updateCode() {
  code = playgroundCode(state, mapCapabilities, language);
  $('design-code').innerHTML = highlight(code);
}
function syncControls() {
  for (const [key, button] of paletteButtons)
    button.setAttribute(
      'aria-pressed',
      String(key === state.palette && paletteName(state) !== 'Custom palette'),
    );
  for (const sync of synchronizeInputs) sync();
  for (const key of controlKeys) {
    const input = control(`design-${key}`);
    if (checkbox(input)) input.checked = Boolean(state[key]);
    else input.value = String(state[key]);
  }
  for (const key of ['weight', 'size', 'radius'] as const)
    $(`${key}-value`).textContent = `${state[key]}${key === 'weight' ? '' : ' px'}`;
  const staticPreview = state.render === 'static';
  requiredInput('neighborhoodLabels').disabled = staticPreview;
  for (const key of keys(featureNames))
    requiredInput(key).disabled =
      staticPreview ||
      ((key === 'layerTransitions' || key === 'districtMorph') && !mapCapabilities[key]);
  for (const key of ['font', 'weight', 'size', 'radius', 'chrome'])
    control(`design-${key}`).disabled = staticPreview;
  control('design-animation').disabled = !staticPreview || !mapCapabilities.animation;
  control('design-title').disabled = !staticPreview;
  $('preview-interactive').setAttribute('aria-pressed', String(!staticPreview));
  $('preview-static').setAttribute('aria-pressed', String(staticPreview));
  button('design-undo').disabled = !ready || historyIndex === 0;
  button('design-redo').disabled = !ready || historyIndex === history.length - 1;
}
function commit() {
  if (!ready) return;
  pendingCommit = true;
  syncControls();
  schedulePaint();
}
function recordHistory() {
  const snapshot = structuredClone(state);
  if (JSON.stringify(snapshot) !== JSON.stringify(history[historyIndex])) {
    history.splice(historyIndex + 1);
    history.push(snapshot);
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
  }
}
function schedulePaint() {
  if (!ready || frame) return;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    paint();
  });
}
function mountBrowser(options: MapOptions): MapController {
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
      $('design-selection').textContent = marker
        ? (marker.label ?? marker.id)
        : 'Pin selection cleared.';
    });
    restoreBrowserView(map);
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
    if (
      JSON.stringify({ appearance, mode, source, year, labels, layers, features, controls }) !==
      JSON.stringify(
        lastOptions && {
          appearance: lastOptions.appearance,
          mode: lastOptions.mode,
          source: lastOptions.source,
          year: lastOptions.year,
          labels: lastOptions.labels,
          layers: lastOptions.layers,
          features: lastOptions.features,
          controls: lastOptions.controls,
        },
      )
    )
      map.configure({ appearance, mode, source, year, labels, layers, features, controls });
    if (JSON.stringify(markers) !== JSON.stringify(lastOptions?.markers))
      map.setMarkers(markers ?? []);
    if (JSON.stringify(overlays) !== JSON.stringify(lastOptions?.overlays))
      map.setOverlays(overlays ?? []);
  } else {
    const viewport = map.camera.get();
    const marker = map.getSelectedMarker(),
      district = map.getSelectedDistrict(),
      neighborhood = map.getSelectedNeighborhood();
    // Prepare a replacement first so a failed construction leaves the current preview usable.
    const previous = map;
    map = undefined;
    let replacement: MapController;
    try {
      replacement = mountBrowser(options);
    } catch (error) {
      map = previous;
      throw error;
    }
    previous.destroy();
    replacement.camera.set(viewport, { animate: false });
    if (marker) replacement.selectMarker(marker.id, { fit: false });
    if (district) replacement.selectDistrict(district.id, { fit: false });
    if (neighborhood && neighborhood.source === state.source)
      replacement.selectNeighborhood(neighborhood.id, { fit: false });
  }
  lastOptions = structuredClone(options);
  if (!map) throw new Error('Interactive preview could not be created.');
  return map;
}

function paint() {
  try {
    $('design-map').dataset.updateStrategy = mapCapabilities.runtimeAppearance
      ? 'configure'
      : 'reconstruct';
    if (state.render === 'static') {
      $('design-map').innerHTML = renderMap(
        staticData(data, state.source),
        staticOptions(state, mapCapabilities),
      ).svg;
      if (map) rememberBrowserView(map);
      map?.destroy();
      map = undefined;
      lastOptions = undefined;
      $('design-selection').textContent = 'Self-contained SVG · full city extent';
    } else {
      const controller = mountBrowser(interactiveOptions(state, mapCapabilities));
      if ($('design-map').firstElementChild !== controller.element) {
        $('design-map').replaceChildren(controller.element);
        $('design-selection').textContent = state.pins
          ? 'Choose a pin or explore the map.'
          : 'Click an area to explore. Drag to pan.';
      }
      enhanceDropdowns(controller.element);
    }
    $('design-map').querySelector('svg')?.setAttribute('data-design-preview', '');
    $('edition-name').textContent = paletteName(state);
    $('edition-year').textContent = String(state.year);
    updateCode();
    $('live-state').textContent = '● All changes live';
    $('design-map').setAttribute('aria-busy', 'false');
    appliedState = structuredClone(state);
    if (pendingCommit) recordHistory();
    pendingCommit = false;
    syncControls();
    const resolved = map?.getResolvedConfiguration?.();
    const available = map?.getCapabilities?.();
    $('design-inspector').replaceChildren(
      ...keys(layerNames).map((key) => {
        const name = layerNames[key];
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
    return true;
  } catch (error) {
    pendingCommit = false;
    state = structuredClone(appliedState);
    syncControls();
    $('live-state').textContent = 'Could not apply design';
    $('design-selection').textContent =
      error instanceof Error ? error.message : 'The design could not be applied.';
    return false;
  }
}
for (const render of ['interactive', 'static'] as const)
  $(`preview-${render}`).addEventListener('click', () => {
    if (ready) {
      state.render = render;
      commit();
    }
  });
$('design-undo').addEventListener('click', () => {
  if (historyIndex > 0) {
    const previous = history[historyIndex - 1];
    if (!previous) return;
    historyIndex--;
    state = structuredClone(previous);
    syncControls();
    schedulePaint();
  }
});
$('design-redo').addEventListener('click', () => {
  if (historyIndex < history.length - 1) {
    const next = history[historyIndex + 1];
    if (!next) return;
    historyIndex++;
    state = structuredClone(next);
    syncControls();
    schedulePaint();
  }
});
$('design-reset').addEventListener('click', () => {
  state = initialState();
  browserView = undefined;
  map?.camera.reset({ animate: false });
  commit();
});
$('design-copy').addEventListener('click', (event) => copyText(event.currentTarget, code));
$('design-share').addEventListener('click', (event) => {
  const url = new URL(location.href);
  url.hash = designHash(state);
  copyText(event.currentTarget, url.href);
});
let exportData: Promise<MapData> | undefined;
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
  const exportButton = button('design-download');
  const original = [...exportButton.childNodes];
  exportButton.disabled = true;
  exportButton.textContent = 'Preparing SVG…';
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
    exportButton.disabled = false;
    exportButton.replaceChildren(...original);
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
  if (map) rememberBrowserView(map);
  map?.destroy();
  map = undefined;
  lastOptions = undefined;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && ready) {
    paint();
  }
});
function setReady(enabled: boolean) {
  ready = enabled;
  const fields = $('design-fields');
  if (!(fields instanceof HTMLFieldSetElement)) throw new Error('Missing design fieldset.');
  fields.disabled = !enabled;
  for (const key of [
    'preview-interactive',
    'preview-static',
    'design-reset',
    'design-share',
    'design-download',
    'design-copy',
  ])
    button(key).disabled = !enabled;
  syncControls();
}
syncControls();
try {
  data = await loadSiteMapData();
  setReady(true);
  syncControls();
  if (!paint()) throw new Error('Initial preview failed.');
  if (linkError) $('design-selection').textContent = linkError;
} catch {
  setReady(false);
  map?.destroy();
  map = undefined;
  $('live-state').textContent = 'Geography unavailable';
  $('design-map').setAttribute('aria-busy', 'false');
  const message = element('p', 'The map could not load. Reload to try again.', 'stage-loading');
  const retry = element('button', 'Reload playground', 'button secondary small');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  message.append(document.createElement('br'), retry);
  $('design-map').replaceChildren(message);
}
