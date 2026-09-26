import type { Bounds, NeighborhoodFeature, NeighborhoodSource } from '../data/index.js';
import {
  bartStations,
  getNeighborhood,
  landmarks,
  neighborhoodCollections,
  searchNeighborhoods,
} from '../data/index.js';
import type { View } from './explorer-layout.js';
import {
  clampView,
  fitBounds,
  interiorAnchor,
  layoutLabels,
  projectedBounds,
} from './explorer-layout.js';
import { geometryPath } from './geometry.js';
import { createSFMap } from './index.js';

export interface NeighborhoodExplorerOptions {
  source?: NeighborhoodSource;
  /** Canonical name, source name, alias, or stable ID in the selected source. */
  neighborhood?: string;
  year?: 2002 | 2012 | 2022;
}
export interface NeighborhoodExplorerElement extends HTMLElement {
  /** Select and fit a neighborhood; returns false when no exact name or alias matches. */
  selectNeighborhood(name: string): boolean;
  /** Switch definitions, clear selection, and reset to city view. */
  setSource(source: NeighborhoodSource): void;
  resetView(): void;
  /** Multiply zoom, clamped to 1–12×. */
  zoomBy(factor: number): void;
  /** Release listeners, animation frames, resize observer, and download URLs. */
  destroy(): void;
}

interface NeighborhoodItem {
  feature: NeighborhoodFeature;
  node: SVGPathElement;
  bounds: Bounds;
  point: [number, number] | undefined;
  area: number;
}
interface LabelItem {
  point: [number, number];
  name: string;
  kind: string;
}

const svgNS = 'http://www.w3.org/2000/svg';
const sourceNames = {
  realtor: 'SFAR realtor · 92 areas',
  'sf-find': 'SF Find · 117 areas',
  analysis: 'City analysis · 41 areas',
};
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/** Create an offline, browser-only neighborhood explorer. Call destroy() before disposal. */
export function createNeighborhoodExplorer({
  source = 'realtor',
  neighborhood,
  year = 2022,
}: NeighborhoodExplorerOptions = {}): NeighborhoodExplorerElement {
  if (!Object.hasOwn(neighborhoodCollections, source))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
  if (neighborhood === '') neighborhood = undefined;
  if (neighborhood !== undefined && !getNeighborhood(neighborhood, { source }))
    throw new RangeError(`Unknown neighborhood: ${neighborhood}`);
  if (typeof document === 'undefined')
    throw new Error('The neighborhood explorer requires a browser document.');
  const controller = new AbortController();
  function listen<K extends keyof GlobalEventHandlersEventMap>(
    node: HTMLElement | SVGElement | Window,
    event: K,
    handler: (event: GlobalEventHandlersEventMap[K]) => void,
    options: AddEventListenerOptions = {},
  ) {
    node.addEventListener(
      event,
      (incoming: Event) => handler(incoming as GlobalEventHandlersEventMap[K]),
      { ...options, signal: controller.signal },
    );
  }
  const root = element('section', '', 'sf-explorer');
  root.setAttribute('aria-label', 'San Francisco neighborhood explorer');
  const style = element('style');
  style.textContent = `
.sf-explorer{container:sf-neighborhood-explorer / inline-size;font:14px/1.5 system-ui,sans-serif;color:#304958;background:#fbfcf9;border:1px solid #d5dfdf;border-radius:16px;overflow:hidden;max-width:1120px;margin:auto}.sf-explorer *{box-sizing:border-box}.sf-explorer h2,.sf-explorer p{margin:0}.sf-explorer button,.sf-explorer input,.sf-explorer select,.sf-explorer a{font:inherit}.sf-explorer button,.sf-explorer select,.sf-explorer input{color:inherit;border:1px solid #becfd0;border-radius:8px;background:#fff;min-height:44px;padding:9px 12px}.sf-explorer button{cursor:pointer}.sf-explorer button:hover,.sf-explorer button[aria-pressed=true]{background:#e1eded;border-color:#547a7d}.sf-explorer :focus-visible{outline:3px solid #24789a;outline-offset:2px}.sf-explorer-header{padding:22px 24px;border-bottom:1px solid #d5dfdf}.sf-explorer-header h2{font-size:23px;letter-spacing:-.5px}.sf-explorer-header p{color:#60777d;margin-top:4px}.sf-explorer-body{display:grid;grid-template-columns:280px minmax(0,1fr);grid-template-areas:"panel map" "detail map";grid-template-rows:auto 1fr}.sf-explorer-panel{grid-area:panel;padding:18px;display:flex;flex-direction:column;gap:14px;border-right:1px solid #d5dfdf;min-width:0}.sf-explorer-panel label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:650}.sf-explorer-panel input,.sf-explorer-panel select{width:100%;font-weight:400;font-size:14px}.sf-explorer-results{display:flex;flex-direction:column;gap:5px;max-height:255px;overflow:auto;padding:3px;margin:-3px;overscroll-behavior:contain}.sf-explorer-results button{text-align:left;flex-shrink:0}.sf-explorer-count,.sf-explorer-note{font-size:12px;color:#60777d}.sf-explorer-detail{grid-area:detail;border-top:1px solid #d5dfdf;border-right:1px solid #d5dfdf;padding:18px;overflow-wrap:anywhere;align-self:stretch}.sf-explorer-detail details{font-size:12px;margin-top:12px}.sf-explorer-detail summary{cursor:pointer;color:#526c74;min-height:32px}.sf-explorer-detail details p{margin-top:8px}.sf-explorer-detail h3{margin:0 0 5px;font-size:17px}.sf-explorer-detail p{font-size:12px;margin-bottom:10px}.sf-explorer-download{display:block;margin:8px 0;color:#245e76;text-underline-offset:3px}.sf-explorer-map-column{grid-area:map;min-width:0;background:#e7f0f3}.sf-explorer-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:12px;background:#f6f9f5}.sf-explorer-control-group{display:flex;align-items:center;gap:6px}.sf-explorer-toolbar button{min-width:44px;padding:6px 10px}.sf-explorer-zoom{font-size:12px;min-width:42px;text-align:center;font-variant-numeric:tabular-nums}.sf-explorer-canvas{position:relative;aspect-ratio:1;overflow:hidden;touch-action:pan-y}.sf-explorer-canvas>svg{display:block;width:100%;height:100%;max-width:none;cursor:grab;user-select:none}.sf-explorer-canvas>svg:active{cursor:grabbing}.sf-explorer-canvas path[data-neighborhood-id]{cursor:pointer}.sf-explorer-hint{padding:10px 14px;font-size:12px;color:#60777d;background:#f6f9f5}.sf-explorer text{pointer-events:none}.sf-explorer-status{padding:0 14px 12px;font-size:12px;background:#f6f9f5}.sf-explorer button:disabled{opacity:.45;cursor:default}@container sf-neighborhood-explorer (max-width:650px){.sf-explorer-body{grid-template-columns:1fr;grid-template-areas:"panel" "map" "detail";grid-template-rows:auto auto auto}.sf-explorer-header{padding:17px}.sf-explorer-header h2{font-size:21px}.sf-explorer-panel{border-right:0;border-bottom:1px solid #d5dfdf;padding:14px;gap:10px}.sf-explorer-results{max-height:140px}.sf-explorer-detail{padding:14px;border-right:0}.sf-explorer-toolbar{padding:8px;gap:6px}.sf-explorer-control-group{gap:4px}.sf-explorer-pan-controls{flex-basis:100%}.sf-explorer-toolbar button{padding:5px 8px}.sf-explorer-download{display:inline-block;margin:4px 14px 4px 0}}`;
  root.append(style);
  const header = element('header', '', 'sf-explorer-header');
  header.append(
    element('h2', 'San Francisco, neighborhood by neighborhood'),
    element('p', 'Find a familiar name. Explore its boundary. Take the data with you.'),
  );
  root.append(header);
  const body = element('div', '', 'sf-explorer-body');
  const panel = element('div', '', 'sf-explorer-panel');
  const sourceLabel = element('label', 'Neighborhood definitions');
  const sourceSelect = element('select');
  for (const [value, title] of Object.entries(sourceNames)) {
    const option = element('option', title);
    option.value = value;
    sourceSelect.append(option);
  }
  sourceSelect.value = source;
  sourceLabel.append(sourceSelect);
  const searchLabel = element('label', 'Find a neighborhood');
  const search = element('input');
  search.type = 'search';
  search.placeholder = 'Try Mission, Outer Mission, or NoPa';
  search.autocomplete = 'off';
  searchLabel.append(search);
  const count = element('p', '', 'sf-explorer-count');
  count.setAttribute('aria-live', 'polite');
  const results = element('div', '', 'sf-explorer-results');
  results.setAttribute('aria-label', 'Matching neighborhoods');
  results.setAttribute('role', 'group');
  const detail = element('div', '', 'sf-explorer-detail');
  panel.append(sourceLabel, searchLabel, count, results);
  const column = element('div', '', 'sf-explorer-map-column');
  const toolbar = element('div', '', 'sf-explorer-toolbar');
  toolbar.setAttribute('aria-label', 'Map controls');
  const canvas = element('div', '', 'sf-explorer-canvas');
  const hint = element(
    'p',
    'Drag to pan · Ctrl/⌘ + scroll to zoom · buttons work on touch screens',
    'sf-explorer-hint',
  );
  const status = element('p', '', 'sf-explorer-status');
  status.setAttribute('aria-live', 'polite');
  column.append(toolbar, canvas, hint, status);
  body.append(panel, column, detail);
  root.append(body);
  const map = createSFMap({
    year,
    districtLabels: false,
    districtLines: false,
    highways: true,
    landmarks: true,
    bartStations: false,
  });
  canvas.innerHTML = map.svg;
  const renderedSvg = canvas.querySelector('svg');
  if (!renderedSvg) throw new Error('The renderer did not produce an SVG.');
  const svg = renderedSvg;
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    'Neighborhood map. Use search results and map controls to explore.',
  );
  svg.removeAttribute('aria-labelledby');
  svg.querySelector('[data-layer="landmark-labels"]')?.remove();
  const geography = svg.querySelector('[data-layer="geography"]');
  if (!geography) throw new Error('The renderer did not produce a geography layer.');
  const areas = svgElement('g', { 'data-layer': 'explorer-neighborhoods' });
  const stations = svgElement('g', { 'data-layer': 'explorer-bart' });
  const labelLayer = svgElement('g', {
    'data-layer': 'explorer-labels',
    'aria-hidden': 'true',
    'font-family': 'system-ui,sans-serif',
  });
  geography.append(areas, stations, labelLayer);
  let view: View = [0, 0, 800];
  let selected: NeighborhoodFeature | undefined;
  let items: NeighborhoodItem[] = [];
  let destroyed = false;
  let frame = 0;
  const downloads = new Set<string>();
  const stationItems = bartStations.features.map((feature) => {
    if (feature.geometry.type !== 'Point')
      throw new TypeError('BART stations must use Point geometry.');
    return {
      point: map.project(feature.geometry.coordinates),
      name: feature.properties.name,
      kind: 'bart',
      node: svgElement('circle'),
    };
  });
  for (const station of stationItems) {
    station.node = svgElement('circle', {
      cx: station.point[0],
      cy: station.point[1],
      fill: '#fff',
      stroke: '#24789a',
      'stroke-width': 2,
      'vector-effect': 'non-scaling-stroke',
    });
    const title = svgElement('title');
    title.textContent = `${station.name} BART station`;
    station.node.append(title);
    stations.append(station.node);
  }
  const parkItems = landmarks.features.map((feature) => ({
    point: map.project(feature.properties.label),
    name: feature.properties.name,
    kind: 'park',
  }));
  const zoomControls = element('div', '', 'sf-explorer-control-group');
  const panControls = element('div', '', 'sf-explorer-control-group sf-explorer-pan-controls');
  toolbar.append(zoomControls, panControls);
  function button(text: string, label: string, action: () => void, group = zoomControls) {
    const node = element('button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    listen(node, 'click', action);
    group.append(node);
    return node;
  }
  const zoomOut = button('−', 'Zoom out', () => zoomBy(1 / 1.5));
  const zoomText = element('span', '100%', 'sf-explorer-zoom');
  zoomControls.append(zoomText);
  const zoomIn = button('+', 'Zoom in', () => zoomBy(1.5));
  button('Reset', 'Reset map to city view', resetView);
  for (const [symbol, label, dx, dy] of [
    ['←', 'Pan west', -1, 0],
    ['↑', 'Pan north', 0, -1],
    ['↓', 'Pan south', 0, 1],
    ['→', 'Pan east', 1, 0],
  ] as const)
    button(
      symbol,
      label,
      () => setView([view[0] + (dx * view[2]) / 4, view[1] + (dy * view[2]) / 4, view[2]]),
      panControls,
    );
  function setView(next: View) {
    if (destroyed) return;
    view = clampView(next);
    svg.setAttribute('viewBox', `${view[0]} ${view[1]} ${view[2]} ${view[2]}`);
    const zoom = 800 / view[2];
    zoomText.textContent = `${Math.round(zoom * 100)}%`;
    root.dataset.zoom = String(zoom);
    zoomIn.disabled = zoom >= 12;
    zoomOut.disabled = zoom <= 1;
    scheduleLabels();
  }
  function zoomBy(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0)
      throw new RangeError('Zoom factor must be positive and finite.');
    const size = Math.max(800 / 12, Math.min(800, view[2] / factor));
    setView([view[0] + (view[2] - size) / 2, view[1] + (view[2] - size) / 2, size]);
  }
  function resetView() {
    setView([0, 0, 800]);
  }
  function scheduleLabels() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drawLabels);
  }
  function drawLabels() {
    if (destroyed) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    labelLayer.replaceChildren();
    const unit = view[2] / width,
      zoom = 800 / view[2];
    for (const station of stationItems) station.node.setAttribute('r', String(3.7 * unit));
    const selectedItem = items.find((item) => item.feature === selected);
    const candidates: LabelItem[] = [];
    if (selectedItem?.point)
      candidates.push({
        ...selectedItem,
        point: selectedItem.point,
        name: selectedItem.feature.properties.canonicalName,
        kind: 'selected',
      });
    if (zoom >= 1.8) candidates.push(...stationItems);
    candidates.push(
      ...parkItems.filter(
        (park) =>
          zoom >= 1.8 ||
          park.name === 'Golden Gate Park' ||
          (width >= 550 && park.name === 'Presidio'),
      ),
    );
    if (zoom >= (width < 500 ? 2.5 : 1.7))
      candidates.push(
        ...items
          .filter(
            (item): item is NeighborhoodItem & { point: [number, number] } =>
              item.feature !== selected && item.point !== undefined,
          )
          .sort((a, b) => b.area - a.area || a.feature.id.localeCompare(b.feature.id))
          .map((item) => ({
            ...item,
            name: item.feature.properties.canonicalName,
            kind: 'neighborhood',
          })),
      );
    const measured = candidates.map((item) => {
      const node = svgElement('text', {
        'font-size': 12 * unit,
        'font-weight': item.kind === 'selected' ? 700 : 550,
        fill: item.kind === 'bart' ? '#166783' : item.kind === 'park' ? '#3e6346' : '#304958',
        stroke: '#f9fcf8',
        'stroke-width': 3 * unit,
        'stroke-linejoin': 'round',
        'paint-order': 'stroke',
        'data-label-kind': item.kind,
      });
      node.textContent = item.name;
      labelLayer.append(node);
      return {
        ...item,
        node,
        x: (item.point[0] - view[0]) / unit,
        y: (item.point[1] - view[1]) / unit,
        textWidth: node.getComputedTextLength() / unit,
        textHeight: 15,
        offset: item.kind === 'bart' ? 9 : 0,
      };
    });
    const placed = layoutLabels(measured, width, width);
    for (const item of measured) item.node.remove();
    for (const item of placed) {
      item.node.setAttribute('x', String(view[0] + item.left * unit));
      item.node.setAttribute('y', String(view[1] + (item.top + 12) * unit));
      labelLayer.append(item.node);
    }
    root.dataset.visibleLabels = String(placed.length);
  }
  function releaseDownloads() {
    for (const url of downloads) URL.revokeObjectURL(url);
    downloads.clear();
  }
  function downloadLink(text: string, value: unknown, filename: string) {
    const link = element('a', text, 'sf-explorer-download');
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/geo+json' }),
    );
    downloads.add(url);
    link.href = url;
    link.download = filename;
    return link;
  }
  function updateDetail() {
    releaseDownloads();
    detail.replaceChildren();
    const collection = neighborhoodCollections[source];
    detail.append(
      element('h3', selected ? selected.properties.canonicalName : 'Explore all neighborhoods'),
    );
    const description = selected
      ? `Source name: ${selected.properties.sourceName}${selected.properties.aliases.length ? `. Also known as: ${selected.properties.aliases.join(', ')}` : ''}.`
      : 'Choose a name or click an area to highlight its full boundary.';
    const sourceSummary = {
      realtor: 'SFAR realtor boundaries · August 2010 · 92 distinct areas.',
      'sf-find': 'SF Find neighborhoods · 2006 · 117 approximate areas.',
      analysis: 'City analysis neighborhoods · 41 census-tract-based areas.',
    };
    detail.append(element('p', description), element('p', sourceSummary[source]));
    if (selected)
      detail.append(
        downloadLink(
          'Download neighborhood GeoJSON',
          { ...collection, selection: selected.id, features: [selected] },
          `${source}-${selected.id}.geojson`,
        ),
      );
    detail.append(
      downloadLink(
        `Download all ${collection.features.length} areas`,
        collection,
        `neighborhoods-${source}.geojson`,
      ),
    );
    const provenance = element('details');
    provenance.append(
      element('summary', 'About these boundaries'),
      element('p', collection.definition.description),
    );
    detail.append(provenance);
  }
  function updateResults() {
    const activeElement = document.activeElement;
    const focusedId =
      activeElement instanceof HTMLElement && results.contains(activeElement)
        ? activeElement.dataset.neighborhoodResult
        : undefined;
    const matches = searchNeighborhoods(search.value, { source }).sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    );
    count.textContent = `${matches.length} ${matches.length === 1 ? 'neighborhood' : 'neighborhoods'}${search.value ? ' found' : ' in this collection'}`;
    results.replaceChildren();
    for (const match of matches) {
      const node = element('button', match.canonicalName);
      node.type = 'button';
      node.dataset.neighborhoodResult = match.id;
      node.setAttribute('aria-pressed', String(selected?.id === match.id));
      results.append(node);
      if (focusedId === match.id) node.focus({ preventScroll: true });
    }
    if (!matches.length)
      results.append(
        element('p', 'No matches. Try another name or definition source.', 'sf-explorer-note'),
      );
  }
  function selectNeighborhood(name: string) {
    const feature = getNeighborhood(name, { source });
    if (!feature) return false;
    selected = feature;
    for (const item of items) {
      const active = item.feature === selected;
      item.node.setAttribute('fill', active ? '#548f8a' : 'transparent');
      item.node.setAttribute('fill-opacity', active ? '.3' : '1');
      item.node.setAttribute('stroke', active ? '#245e65' : '#71838a');
      item.node.setAttribute('stroke-width', active ? '2.5' : '.65');
      if (active) areas.append(item.node);
    }
    const selectedItem = items.find((item) => item.feature === selected);
    if (selectedItem) setView(fitBounds(selectedItem.bounds));
    root.dataset.selectedNeighborhood = feature.id;
    updateResults();
    updateDetail();
    status.textContent = `${feature.properties.canonicalName} selected. ${sourceNames[source]}.`;
    root.dispatchEvent(
      new CustomEvent('neighborhoodchange', { bubbles: true, detail: { feature, source } }),
    );
    return true;
  }
  function setSource(next: NeighborhoodSource) {
    if (!Object.hasOwn(neighborhoodCollections, next))
      throw new RangeError(`Unknown neighborhood source: ${next}`);
    source = next;
    sourceSelect.value = source;
    selected = undefined;
    delete root.dataset.selectedNeighborhood;
    root.dataset.source = source;
    areas.replaceChildren();
    items = neighborhoodCollections[source].features.map((feature) => {
      const bounds = projectedBounds(feature.geometry, map.project);
      const node = svgElement('path', {
        d: geometryPath(feature.geometry, map.project),
        'data-neighborhood-id': feature.id,
        fill: 'transparent',
        'fill-rule': 'evenodd',
        stroke: '#71838a',
        'stroke-width': '.65',
        'vector-effect': 'non-scaling-stroke',
      });
      const title = svgElement('title');
      title.textContent = feature.properties.canonicalName;
      node.append(title);
      areas.append(node);
      return {
        feature,
        node,
        bounds,
        point: interiorAnchor(feature.geometry, map.project),
        area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]),
      };
    });
    updateResults();
    updateDetail();
    resetView();
    status.textContent = `${sourceNames[source]}. Select a neighborhood to begin.`;
  }
  listen(search, 'input', updateResults);
  listen(search, 'keydown', (event) => {
    if (event.key === 'Enter') {
      const exact = getNeighborhood(search.value, { source });
      const matches = searchNeighborhoods(search.value, { source });
      if (exact || matches.length === 1) {
        event.preventDefault();
        selectNeighborhood(exact?.id ?? matches[0].id);
      }
    }
  });
  listen(sourceSelect, 'change', () => {
    const next = sourceSelect.value;
    if (next === 'realtor' || next === 'sf-find' || next === 'analysis') setSource(next);
  });
  listen(results, 'click', (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-neighborhood-result]')
        : null;
    if (node?.dataset.neighborhoodResult) selectNeighborhood(node.dataset.neighborhoodResult);
  });
  let drag: { x: number; y: number; view: View; id: number } | undefined;
  let suppressClick = false;
  listen(svg, 'pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, view: [...view], id: event.pointerId };
    suppressClick = false;
  });
  listen(window, 'pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) suppressClick = true;
    if (suppressClick) {
      const scale = drag.view[2] / canvas.getBoundingClientRect().width;
      setView([drag.view[0] - dx * scale, drag.view[1] - dy * scale, drag.view[2]]);
    }
  });
  listen(window, 'pointerup', () => {
    drag = undefined;
  });
  listen(window, 'pointercancel', () => {
    drag = undefined;
  });
  listen(svg, 'click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const node =
      event.target instanceof Element
        ? event.target.closest<SVGElement>('[data-neighborhood-id]')
        : null;
    if (node?.dataset.neighborhoodId) selectNeighborhood(node.dataset.neighborhoodId);
  });
  listen(
    svg,
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) / 300));
    },
    { passive: false },
  );
  const observer = new ResizeObserver(scheduleLabels);
  observer.observe(canvas);
  const explorer = Object.assign(root, {
    selectNeighborhood,
    setSource,
    resetView,
    zoomBy,
    destroy() {
      destroyed = true;
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      releaseDownloads();
    },
  });
  setSource(source);
  if (neighborhood !== undefined) selectNeighborhood(neighborhood);
  return explorer;
}
