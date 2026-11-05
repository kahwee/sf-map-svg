import type { MapData } from '@kahwee/sf-map-svg';
import { loadSiteMapData } from '../shared/site-map-data.js';
import { copyText, element, highlight } from '../shared/ui.js';
import { createPlaygroundExport, designUrl } from './export.ts';
import { createPlaygroundHistory } from './history.ts';
import {
  type CodeLanguage,
  colorNames,
  designHash,
  featureNames,
  initialState,
  keys,
  layerNames,
  paletteName,
  palettes,
  playgroundCode,
  readState,
  setMode,
} from './model.ts';
import { createPlaygroundPreview } from './preview.ts';

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
const preview = createPlaygroundPreview($('design-map'), $('design-selection'));
const exporter = createPlaygroundExport(button('design-download'), (message) => {
  $('design-selection').textContent = message;
});
let ready = false,
  code = '';
let frame: number | undefined;
let pendingCommit = false;
let appliedState = structuredClone(state);
const history = createPlaygroundHistory(state);
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
  code = playgroundCode(state, language);
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
  for (const key of keys(featureNames)) requiredInput(key).disabled = staticPreview;
  for (const key of ['font', 'weight', 'size', 'radius', 'chrome'])
    control(`design-${key}`).disabled = staticPreview;
  control('design-animation').disabled = !staticPreview;
  control('design-title').disabled = !staticPreview;
  $('preview-interactive').setAttribute('aria-pressed', String(!staticPreview));
  $('preview-static').setAttribute('aria-pressed', String(staticPreview));
  button('design-undo').disabled = !ready || !history.canUndo;
  button('design-redo').disabled = !ready || !history.canRedo;
}
function commit() {
  if (!ready) return;
  pendingCommit = true;
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

function paint() {
  try {
    const { resolved, available } = preview.render(data, state);
    $('edition-name').textContent = paletteName(state);
    $('edition-year').textContent = String(state.year);
    updateCode();
    $('live-state').textContent = '● All changes live';
    $('design-map').setAttribute('aria-busy', 'false');
    appliedState = structuredClone(state);
    if (pendingCommit) history.record(state);
    pendingCommit = false;
    syncControls();
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
for (const action of ['undo', 'redo'] as const)
  $(`design-${action}`).addEventListener('click', () => {
    const restored = history[action]();
    if (!restored) return;
    state = restored;
    syncControls();
    schedulePaint();
  });
$('design-reset').addEventListener('click', () => {
  state = initialState();
  preview.reset();
  commit();
});
$('design-copy').addEventListener('click', (event) => copyText(event.currentTarget, code));
$('design-share').addEventListener('click', (event) => {
  copyText(event.currentTarget, designUrl(state, location.href));
});
$('design-download').addEventListener('click', () => {
  if (ready) void exporter.download(state);
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
  preview.dispose();
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
  preview.dispose();
  $('live-state').textContent = 'Geography unavailable';
  $('design-map').setAttribute('aria-busy', 'false');
  const message = element('p', 'The map could not load. Reload to try again.', 'stage-loading');
  const retry = element('button', 'Reload playground', 'button secondary small');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  message.append(document.createElement('br'), retry);
  $('design-map').replaceChildren(message);
}
