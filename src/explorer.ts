import type { Bounds, NeighborhoodFeature, NeighborhoodSource } from '../data/index.js';
import {
  bartStations,
  districtMaps,
  getNeighborhood,
  keyRoads,
  landmarks,
  neighborhoodCollections,
  searchNeighborhoods,
} from '../data/index.js';
import type { View } from './explorer-layout.js';
import { fitBounds, interiorAnchor, layoutLabels, projectedBounds } from './explorer-layout.js';
import { geometryPath } from './geometry.js';
import { createSFMap, districtColors } from './index.js';
import { attachNavigation } from './navigation.js';
import type {
  ExplorerMode,
  MapMarker,
  MapViewport,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
  NeighborhoodSelection,
} from './types.js';
import { fitViewport, validateViewport } from './viewport.js';

export type {
  ExplorerMode,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
} from './types.js';

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
  mode = 'neighborhoods',
  labels = true,
  neighborhood,
  year = 2022,
  theme = 'transit',
  interface: chrome = 'explorer',
  layers = {},
  selectableNeighborhoods = true,
  labelSize = {},
  fitPadding = 24,
  markers: initialMarkers = [],
  markerRadius = 6,
  markerHitSize = 44,
  markerColor = '#245b61',
  selectedMarkerColor = '#f04f32',
  onMarkerActivate,
}: NeighborhoodExplorerOptions = {}): NeighborhoodExplorerElement {
  if (!['neighborhoods', 'districts', 'basemap'].includes(mode))
    throw new RangeError(`Unknown map mode: ${mode}`);
  if (chrome !== 'explorer' && chrome !== 'map') throw new RangeError('Unknown interface.');
  const minLabelSize = labelSize.min ?? 11,
    maxLabelSize = labelSize.max ?? 12;
  if (
    ![minLabelSize, maxLabelSize, markerRadius, markerHitSize].every(Number.isFinite) ||
    minLabelSize < 8 ||
    maxLabelSize < minLabelSize ||
    maxLabelSize > 32 ||
    markerRadius <= 0 ||
    markerHitSize < markerRadius * 2
  )
    throw new RangeError(
      'Use label sizes from 8–32px and a positive marker radius inside its hit target.',
    );
  layers = { ...layers };
  const enabled = (layer: keyof NonNullable<NeighborhoodExplorerOptions['layers']>) =>
    layers[layer] ??
    (layer.startsWith('district')
      ? mode === 'districts'
      : layer.startsWith('neighborhood')
        ? mode === 'neighborhoods'
        : true);
  if (typeof labels !== 'boolean') throw new TypeError('Labels must be a boolean.');
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
.sf-explorer{container:sf-neighborhood-explorer / inline-size;font:14px/1.5 system-ui,sans-serif;color:#18364f;background:#fff;border:1px solid #cedae3;border-radius:14px;overflow:hidden;max-width:1120px;margin:auto;box-shadow:0 8px 32px #18364f08}
.sf-explorer *{box-sizing:border-box}
.sf-explorer [hidden]{display:none!important}
.sf-explorer h2,.sf-explorer p{margin:0}
.sf-explorer button,.sf-explorer input,.sf-explorer select,.sf-explorer a{font:inherit}
.sf-explorer button,.sf-explorer select,.sf-explorer input{color:inherit;border:1px solid #c7d5df;border-radius:7px;background:#fff;min-height:44px;padding:9px 12px}
.sf-explorer button{cursor:pointer;transition:background .12s,border-color .12s}
.sf-explorer button:hover{background:#f0f6fa;border-color:#8ba9c0}
.sf-explorer button[aria-pressed=true]{color:#123d63;background:#e6f1f9;border-color:#5689b0;font-weight:650}
.sf-explorer :focus-visible{outline:3px solid #1676b8;outline-offset:2px}
.sf-explorer-header{padding:24px;border-top:4px solid #163d61;border-bottom:1px solid #dce5eb}
.sf-explorer-header h2{font-size:25px;line-height:1.25;font-weight:700;letter-spacing:-.7px}
.sf-explorer-header p{color:#586f80;margin-top:8px;max-width:58ch}
.sf-explorer-body{display:grid;grid-template-columns:280px minmax(0,1fr);grid-template-areas:"panel map" "detail map";grid-template-rows:auto 1fr}
.sf-explorer-panel{grid-area:panel;padding:18px;display:flex;flex-direction:column;gap:14px;border-right:1px solid #dce5eb;min-width:0}
.sf-explorer-panel label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650}
.sf-explorer-panel input,.sf-explorer-panel select{width:100%;font-weight:400;font-size:14px}
.sf-explorer-panel input::placeholder{color:#6a7f8e}
.sf-explorer-results{display:flex;flex-direction:column;gap:5px;max-height:255px;overflow:auto;padding:3px;margin:-3px;overscroll-behavior:contain}
.sf-explorer-results button{text-align:left;flex-shrink:0}
.sf-explorer-count,.sf-explorer-note{font-size:12px;color:#586f80}
.sf-explorer-detail{grid-area:detail;border-top:1px solid #dce5eb;border-right:1px solid #dce5eb;padding:18px;overflow-wrap:anywhere;align-self:stretch;background:#fafcfd}
.sf-explorer-detail details{font-size:12px;margin-top:12px}
.sf-explorer-detail summary{cursor:pointer;color:#496578;min-height:32px}
.sf-explorer-detail details p{margin-top:8px}
.sf-explorer-detail h3{margin:0 0 7px;font-size:18px;line-height:1.3;letter-spacing:-.2px}
.sf-explorer-detail p{font-size:12px;margin-bottom:10px}
.sf-explorer-download{display:block;margin:8px 0;color:#12649c;text-underline-offset:3px}
.sf-explorer-map-column{grid-area:map;min-width:0;background:#e4f2f8}
.sf-explorer-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:12px;background:#fff;border-bottom:1px solid #dce5eb}
.sf-explorer-control-group{display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%}
.sf-explorer-pan-controls{margin-left:auto}
.sf-explorer-toolbar button{min-width:44px;padding:6px 10px}
.sf-explorer-zoom{font-size:12px;min-width:42px;text-align:center;font-variant-numeric:tabular-nums;color:#496578}
.sf-explorer-canvas{position:relative;aspect-ratio:1;overflow:hidden;touch-action:pan-y pinch-zoom}
.sf-explorer-canvas>svg{display:block;width:100%;height:100%;max-width:none;cursor:grab;user-select:none}
.sf-explorer-canvas>svg:active{cursor:grabbing}
.sf-explorer-canvas path[data-neighborhood-id]{cursor:pointer}
.sf-explorer-legend{display:flex;flex-wrap:wrap;gap:8px 20px;padding:14px 16px 8px;background:#fff;border-top:1px solid #dce5eb;color:#496578;font-size:12px}
.sf-explorer-legend-item{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.sf-explorer-legend-symbol{display:inline-block;flex:none;width:15px;height:11px;border-radius:2px}
.sf-explorer-legend-bart{width:10px;height:10px;margin:0 2px;border:2px solid #0073ae;border-radius:50%;background:#fff}
.sf-explorer-legend-park{background:#c6dfbd;border:1px solid #a8c69d}
.sf-explorer-legend-road{height:2px;border-radius:2px;background:#bcc3c5}
.sf-explorer-legend-highway{height:3px;border-radius:2px;background:#b9a18a}
.sf-explorer-hint{padding:6px 16px 10px;font-size:12px;color:#586f80;background:#fff}
.sf-explorer text{pointer-events:none}
.sf-explorer-status{padding:0 16px 14px;font-size:12px;background:#fff;color:#496578}
.sf-explorer[data-interface=map] .sf-explorer-body{display:block}
.sf-explorer[data-interface=map] .sf-explorer-header,.sf-explorer[data-interface=map] .sf-explorer-panel,.sf-explorer[data-interface=map] .sf-explorer-detail{display:none}
.sf-explorer-feature-controls{display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#fff}
.sf-explorer-feature-controls label{display:flex;flex:1;flex-direction:column;min-width:0}
.sf-explorer-feature-controls select{width:100%;min-width:0}
.sf-explorer svg [role=button]:focus-visible{outline:none;stroke:#102f72;stroke-width:3;fill-opacity:.3}
@media(prefers-reduced-motion:reduce){.sf-explorer button{transition:none}}
.sf-explorer button:disabled{opacity:.45;cursor:default}
@container sf-neighborhood-explorer (max-width:650px){
.sf-explorer-body{grid-template-columns:1fr;grid-template-areas:"panel" "map" "detail";grid-template-rows:auto auto auto}
.sf-explorer-header{padding:18px}
.sf-explorer-header h2{font-size:23px}
.sf-explorer-header p{font-size:13px}
.sf-explorer-panel{border-right:0;border-bottom:1px solid #dce5eb;padding:14px;gap:10px}
.sf-explorer-results{max-height:140px}
.sf-explorer-feature-controls{flex-direction:column}
.sf-explorer-detail{padding:14px;border-right:0}
.sf-explorer-toolbar{padding:8px;gap:6px}
.sf-explorer-control-group{gap:4px}
.sf-explorer-pan-controls{flex-basis:100%;margin-left:0}
.sf-explorer-toolbar button{padding:5px 8px}
.sf-explorer-legend{gap:8px 16px;padding:12px 14px 8px}
.sf-explorer-download{display:inline-block;margin:4px 14px 4px 0}
}`;
  root.dataset.interface = chrome;
  root.append(style);
  const header = element('header', '', 'sf-explorer-header');
  header.append(
    element('h2', 'Explore San Francisco'),
    element('p', 'Explore the city, from familiar names to the places in between.'),
  );
  root.append(header);
  const body = element('div', '', 'sf-explorer-body');
  const panel = element('div', '', 'sf-explorer-panel');
  const modeLabel = element('label', 'Map mode');
  const modeSelect = element('select');
  for (const [value, title] of [
    ['neighborhoods', 'Neighborhoods'],
    ['districts', 'Districts'],
    ['basemap', 'Basemap'],
  ] as const) {
    const option = element('option', title);
    option.value = value;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
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
  panel.append(modeLabel, sourceLabel, searchLabel, count, results);
  const column = element('div', '', 'sf-explorer-map-column');
  const toolbar = element('div', '', 'sf-explorer-toolbar');
  toolbar.setAttribute('aria-label', 'Map controls');
  const canvas = element('div', '', 'sf-explorer-canvas');
  const hint = element(
    'p',
    'Drag to pan · Ctrl/⌘ + scroll to zoom · Focus map: arrows pan, +/− zoom, Home resets. Touch: scroll the page, or enable Touch navigation to pan and pinch the map. Escape exits.',
    'sf-explorer-hint',
  );
  const status = element('p', '', 'sf-explorer-status');
  status.setAttribute('aria-live', 'polite');
  const legend = element('div', '', 'sf-explorer-legend');
  legend.setAttribute('aria-label', 'Map legend');
  for (const [kind, label] of [
    ['bart', 'BART station'],
    ['park', 'Park'],
    ['highway', 'Highway'],
    ['road', 'Roads'],
  ] as const) {
    const entry = element('span', '', 'sf-explorer-legend-item');
    const symbol = element('span', '', `sf-explorer-legend-symbol sf-explorer-legend-${kind}`);
    symbol.setAttribute('aria-hidden', 'true');
    entry.append(symbol, document.createTextNode(label));
    legend.append(entry);
  }
  const featureControls = element('div', '', 'sf-explorer-feature-controls');
  const neighborhoodLabel = element('label', 'Select neighborhood');
  const neighborhoodSelect = element('select');
  neighborhoodLabel.append(neighborhoodSelect);
  const markerLabel = element('label', 'Choose marker');
  const markerSelect = element('select');
  markerLabel.append(markerSelect);
  featureControls.append(neighborhoodLabel, markerLabel);
  const attribution = element('p', '', 'sf-explorer-hint');
  column.append(toolbar, featureControls, canvas, legend, hint, status, attribution);
  body.append(panel, column, detail);
  root.append(body);
  const map = createSFMap({
    year,
    theme,
    districtLabels: false,
    districtLines: true,
    districtFills: true,
    highways: enabled('highways'),
    keyRoads: enabled('keyRoads'),
    landmarks: enabled('landmarks'),
    bartStations: false,
  });
  canvas.innerHTML = map.svg;
  const renderedSvg = canvas.querySelector('svg');
  if (!renderedSvg) throw new Error('The renderer did not produce an SVG.');
  const svg = renderedSvg;
  svg.setAttribute('role', 'group');
  svg.setAttribute('tabindex', '0');
  svg.setAttribute(
    'aria-label',
    'Neighborhood map. Use search results and map controls to explore.',
  );
  svg.removeAttribute('aria-labelledby');
  svg.querySelector('[data-layer="landmark-labels"]')?.remove();
  svg.querySelector('[data-layer="key-road-labels"]')?.remove();
  const geography = svg.querySelector('[data-layer="geography"]');
  if (!geography) throw new Error('The renderer did not produce a geography layer.');
  const districtLayers = Array.from(
    svg.querySelectorAll<SVGGElement>(
      '[data-layer="district-fills"], [data-layer="district-lines"]',
    ),
  );
  for (const path of svg.querySelectorAll<SVGPathElement>(
    '[data-layer="district-fills"] path[data-district]',
  )) {
    const color = districtColors[Number(path.dataset.district) - 1];
    if (color) path.setAttribute('fill', color);
  }
  const districtItems: LabelItem[] = districtMaps[year].features.flatMap((feature) =>
    feature.properties.labelPoints.map((point) => ({
      point: map.project(point),
      name: String(feature.properties.district),
      kind: 'district',
    })),
  );
  const markerLayer = svgElement('g', { 'data-layer': 'interactive-markers' });
  const areas = svgElement('g', { 'data-layer': 'explorer-neighborhoods' });
  const stations = svgElement('g', { 'data-layer': 'explorer-bart' });
  const labelLayer = svgElement('g', {
    'data-layer': 'explorer-labels',
    'aria-hidden': 'true',
    'font-family': 'system-ui,sans-serif',
  });
  geography.append(areas, stations, labelLayer, markerLayer);
  let view: View = [0, 0, 800];
  let selected: NeighborhoodFeature | undefined;
  let items: NeighborhoodItem[] = [];
  let destroyed = false;
  let frame = 0;
  const downloads = new Set<string>();
  const stationItems = (enabled('bartStations') ? bartStations.features : []).map((feature) => {
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
      stroke: '#0073ae',
      'stroke-width': 2,
      'vector-effect': 'non-scaling-stroke',
    });
    const title = svgElement('title');
    title.textContent = `${station.name} BART station`;
    station.node.append(title);
    stations.append(station.node);
  }
  const roadItems = (enabled('keyRoads') ? keyRoads.features : []).map((feature) => ({
    point: map.project(feature.properties.label),
    name: feature.properties.name,
    kind: 'road',
  }));
  const parkItems = (enabled('landmarks') ? landmarks.features : []).map((feature) => ({
    point: map.project(feature.properties.label),
    name: feature.properties.name,
    kind: 'park',
  }));
  for (const [kind, option] of [
    ['bart', 'bartStations'],
    ['park', 'landmarks'],
    ['highway', 'highways'],
    ['road', 'keyRoads'],
  ] as const) {
    if (!enabled(option))
      legend.querySelector(`.sf-explorer-legend-${kind}`)?.parentElement?.remove();
  }
  legend.hidden = !legend.children.length;
  let markerItems: {
    marker: MapMarker;
    point: [number, number];
    node: SVGGElement;
    dot: SVGCircleElement;
    hit: SVGCircleElement;
  }[] = [];
  let selectedMarker: string | null = null;
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
  const labelsButton = button('Labels', 'Show map labels', () => setLabels(!labels));
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
  function panBy(x: number, y: number) {
    if (![x, y].every(Number.isFinite))
      throw new RangeError('Pan offsets must be finite screen pixels.');
    const width = canvas.getBoundingClientRect().width;
    if (width) setView([view[0] + (x * view[2]) / width, view[1] + (y * view[2]) / width, view[2]]);
  }
  function getViewport(): MapViewport {
    return [...view];
  }
  function fitGeometry(geometry: import('../data/types.js').Geometry, padding = fitPadding) {
    const width = canvas.getBoundingClientRect().width;
    if (!width) throw new Error('Mount the map in a visible container before fitting geometry.');
    setView(fitViewport(projectedBounds(geometry, map.project), width, padding));
  }
  function setView(next: MapViewport) {
    if (destroyed) return;
    const previous = view;
    view = validateViewport(next);
    svg.setAttribute('viewBox', `${view[0]} ${view[1]} ${view[2]} ${view[2]}`);
    const zoom = 800 / view[2];
    zoomText.textContent = `${Math.round(zoom * 100)}%`;
    root.dataset.zoom = String(zoom);
    zoomIn.disabled = zoom >= 12;
    zoomOut.disabled = zoom <= 1;
    if (view.some((value, i) => value !== previous[i]))
      root.dispatchEvent(
        new CustomEvent('viewportchange', { bubbles: true, detail: { viewport: getViewport() } }),
      );
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
    if (destroyed) return;
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
    for (const station of stationItems) station.node.setAttribute('r', String(4.5 * unit));
    for (const item of markerItems) {
      item.dot.setAttribute(
        'r',
        String((item.marker.id === selectedMarker ? markerRadius + 2 : markerRadius) * unit),
      );
      item.hit.setAttribute('r', String((markerHitSize / 2) * unit));
    }
    if (!labels) {
      root.dataset.visibleLabels = '0';
      return;
    }
    const selectedItem = items.find((item) => item.feature === selected);
    const candidates: LabelItem[] = [];
    const marker = markerItems.find((item) => item.marker.id === selectedMarker);
    if (marker)
      candidates.push({
        point: marker.point,
        name: marker.marker.label ?? marker.marker.id,
        kind: 'selected-marker',
      });
    if (selectedItem?.point && enabled('neighborhoodLabels'))
      candidates.push({
        point: selectedItem.point,
        name: selectedItem.feature.properties.canonicalName,
        kind: 'selected',
      });
    if (enabled('districtLabels')) candidates.push(...districtItems);
    if (zoom >= 1.8) candidates.push(...stationItems);
    candidates.push(
      ...parkItems.filter(
        (park) =>
          zoom >= 1.8 ||
          park.name === 'Golden Gate Park' ||
          (width >= 550 && park.name === 'Presidio'),
      ),
    );
    if (zoom >= 1.8) candidates.push(...roadItems);
    if (enabled('neighborhoodLabels'))
      candidates.push(
        ...items
          .filter(
            (item): item is NeighborhoodItem & { point: [number, number] } =>
              item.feature !== selected && item.point !== undefined,
          )
          .sort((a, b) => b.area - a.area || a.feature.id.localeCompare(b.feature.id))
          .map((item) => ({
            point: item.point,
            name: item.feature.properties.canonicalName,
            kind: 'neighborhood',
          })),
      );
    const measured = candidates.map((item) => {
      const fontSize = Math.max(
        minLabelSize,
        Math.min(maxLabelSize, item.kind === 'road' ? 11 : 12),
      );
      const node = svgElement('text', {
        'font-size': fontSize * unit,
        'font-weight': item.kind.startsWith('selected') || item.kind === 'district' ? 700 : 550,
        fill: item.kind === 'park' ? '#426641' : item.kind === 'road' ? '#77736b' : '#163d61',
        stroke: '#ffffff',
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
        fontSize,
        textHeight: fontSize * 1.25,
        offset: item.kind === 'selected-marker' ? markerRadius + 7 : item.kind === 'bart' ? 11 : 0,
      };
    });
    const stationBounds: Bounds[] = stationItems.map(({ point }) => {
      const x = (point[0] - view[0]) / unit;
      const y = (point[1] - view[1]) / unit;
      return [x - 6, y - 6, x + 6, y + 6];
    });
    const markerBounds: Bounds[] = markerItems.map(({ point }) => {
      const x = (point[0] - view[0]) / unit,
        y = (point[1] - view[1]) / unit;
      return [
        x - markerRadius - 3,
        y - markerRadius - 3,
        x + markerRadius + 3,
        y + markerRadius + 3,
      ];
    });
    const placed = layoutLabels(measured, width, width, [...stationBounds, ...markerBounds]);
    for (const item of measured) item.node.remove();
    for (const item of placed) {
      item.node.setAttribute('x', String(view[0] + item.left * unit));
      item.node.setAttribute('y', String(view[1] + (item.top + item.fontSize) * unit));
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
    if (chrome === 'map') return;
    detail.replaceChildren();
    if (mode === 'districts') {
      const collection = districtMaps[year];
      detail.append(
        element('h3', `${year} supervisorial districts`),
        element(
          'p',
          'Eleven districts, identified by number. Switch to Neighborhoods to explore familiar place names.',
        ),
        downloadLink('Download district GeoJSON', collection, `districts-${year}.geojson`),
        element('p', collection.definition.description),
      );
      return;
    }
    if (mode === 'basemap') {
      detail.append(element('h3', 'San Francisco basemap'));
      return;
    }
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
    if (chrome === 'map') return;
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
  function getSelection(): NeighborhoodSelection | null {
    return selected
      ? { id: selected.id, name: selected.properties.canonicalName, source, feature: selected }
      : null;
  }
  function selectNeighborhood(name: string | null, options: { fit?: boolean } = {}) {
    if (destroyed) return false;
    const feature = name === null ? undefined : getNeighborhood(name, { source });
    if (name !== null && !feature) return false;
    if (feature && !enabled('neighborhoodLines') && !enabled('neighborhoodLabels'))
      setMode('neighborhoods');
    const changed = selected !== feature;
    selected = feature;
    for (const item of items) {
      const active = item.feature === selected;
      item.node.setAttribute('fill', active ? '#408dbe' : 'transparent');
      item.node.setAttribute('fill-opacity', active ? '.16' : '1');
      item.node.setAttribute('stroke', active ? '#176ba2' : '#9caebc');
      item.node.setAttribute(
        'stroke-width',
        active ? '2.2' : enabled('neighborhoodLines') ? '.55' : '0',
      );
      item.node.setAttribute('aria-pressed', String(active));
      if (active) areas.append(item.node);
    }
    const selectedItem = items.find((item) => item.feature === selected);
    if (selectedItem && options.fit !== false) {
      const width = canvas.getBoundingClientRect().width;
      setView(
        width
          ? fitViewport(selectedItem.bounds, width, fitPadding)
          : fitBounds(selectedItem.bounds),
      );
    }
    if (feature) root.dataset.selectedNeighborhood = feature.id;
    else delete root.dataset.selectedNeighborhood;
    neighborhoodSelect.value = feature?.id ?? '';
    scheduleLabels();
    updateResults();
    updateDetail();
    status.textContent = feature
      ? `${feature.properties.canonicalName} selected. ${sourceNames[source]}.`
      : 'Neighborhood selection cleared.';
    if (changed)
      root.dispatchEvent(
        new CustomEvent('neighborhoodchange', {
          bubbles: true,
          detail: {
            feature: feature ?? null,
            source,
            id: feature?.id ?? null,
            name: feature?.properties.canonicalName ?? null,
          },
        }),
      );
    return true;
  }
  function setSource(next: NeighborhoodSource) {
    if (destroyed) return;
    if (!Object.hasOwn(neighborhoodCollections, next))
      throw new RangeError(`Unknown neighborhood source: ${next}`);
    const hadSelection = !!selected;
    source = next;
    sourceSelect.value = source;
    selected = undefined;
    delete root.dataset.selectedNeighborhood;
    root.dataset.source = source;
    areas.replaceChildren();
    neighborhoodSelect.replaceChildren(element('option', 'No neighborhood selected'));
    neighborhoodSelect.options[0].value = '';
    items = neighborhoodCollections[source].features.map((feature) => {
      const bounds = projectedBounds(feature.geometry, map.project);
      const node = svgElement('path', {
        d: geometryPath(feature.geometry, map.project),
        'data-neighborhood-id': feature.id,
        fill: 'transparent',
        'fill-rule': 'evenodd',
        stroke: '#9caebc',
        'stroke-width': '.55',
        'vector-effect': 'non-scaling-stroke',
        role: 'button',
        tabindex: -1,
        'aria-label': feature.properties.canonicalName,
        'aria-pressed': 'false',
      });
      const option = element('option', feature.properties.canonicalName);
      option.value = feature.id;
      neighborhoodSelect.append(option);
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
    if (items[0]) items[0].node.setAttribute('tabindex', '0');
    updateResults();
    updateDetail();
    updateComposition();
    resetView();
    if (hadSelection)
      root.dispatchEvent(
        new CustomEvent('neighborhoodchange', {
          bubbles: true,
          detail: { feature: null, source, id: null, name: null },
        }),
      );
    status.textContent =
      mode === 'basemap'
        ? 'San Francisco basemap.'
        : mode === 'districts'
          ? `${year} supervisorial districts. Numbers identify each district.`
          : `${sourceNames[source]}. Select a neighborhood to begin.`;
  }
  function updateComposition() {
    const neighborhoodsVisible =
      enabled('neighborhoodLines') || (labels && enabled('neighborhoodLabels'));
    areas.style.display = neighborhoodsVisible ? '' : 'none';
    areas.style.pointerEvents = selectableNeighborhoods ? '' : 'none';
    neighborhoodLabel.hidden =
      !neighborhoodsVisible || !selectableNeighborhoods || chrome === 'explorer';
    for (const item of items) {
      item.node.setAttribute(
        'stroke-width',
        item.feature === selected ? '2.2' : enabled('neighborhoodLines') ? '.55' : '0',
      );
      item.node.setAttribute('tabindex', selectableNeighborhoods && item === items[0] ? '0' : '-1');
      item.node.setAttribute('role', selectableNeighborhoods ? 'button' : 'img');
      if (!selectableNeighborhoods) item.node.removeAttribute('aria-pressed');
    }
    for (const layer of districtLayers) {
      const key = layer.dataset.layer === 'district-fills' ? 'districtFills' : 'districtLines';
      layer.style.display = enabled(key) ? '' : 'none';
    }
    const districtsVisible =
      enabled('districtFills') || enabled('districtLines') || (labels && enabled('districtLabels'));
    const descriptions = ['San Francisco map.'];
    if (districtsVisible) descriptions.push(`${year} supervisorial districts, DataSF.`);
    if (neighborhoodsVisible) {
      const collection = neighborhoodCollections[source];
      descriptions.push(`${collection.title}. ${collection.definition.description}`);
    }
    if (enabled('landmarks')) descriptions.push('Park property boundaries from DataSF.');
    if (enabled('highways') || enabled('keyRoads')) descriptions.push('Road geometry from DataSF.');
    if (enabled('bartStations')) descriptions.push('BART station locations from BART.');
    descriptions.push('Display coastline from DataSF. Source downloads: September 2026.');
    const description = descriptions.join(' ');
    const desc = svg.querySelector('desc');
    if (desc) desc.textContent = description;
    const title = svg.querySelector('title');
    if (title) title.textContent = 'San Francisco map';
    svg.setAttribute(
      'aria-label',
      `${description} Arrow keys pan; plus and minus zoom; Home resets. Neighborhoods: brackets move focus; Enter selects. The neighborhood and marker menus include every supplied item.`,
    );
    attribution.textContent = description;
    scheduleLabels();
  }
  function getSelectedMarker() {
    const marker = markerItems.find((item) => item.marker.id === selectedMarker)?.marker;
    return marker ? { ...marker } : null;
  }
  function selectMarker(id: string | null, options: { fit?: boolean } = {}) {
    if (destroyed) return false;
    const item = markerItems.find((item) => item.marker.id === id);
    if (id !== null && !item) return false;
    const changed = selectedMarker !== id;
    selectedMarker = id;
    markerSelect.value = id ?? '';
    for (const entry of markerItems) {
      const active = entry.marker.id === id;
      entry.node.setAttribute('aria-pressed', String(active));
      entry.dot.setAttribute(
        'fill',
        active ? selectedMarkerColor : (entry.marker.color ?? markerColor),
      );
      if (active) markerLayer.append(entry.node);
    }
    if (item && options.fit !== false) {
      const width = canvas.getBoundingClientRect().width;
      const bounds: Bounds = [...item.point, ...item.point];
      setView(width ? fitViewport(bounds, width, fitPadding) : fitBounds(bounds));
    }
    scheduleLabels();
    const marker = getSelectedMarker();
    if (changed)
      root.dispatchEvent(
        new CustomEvent('markerchange', { bubbles: true, detail: { id, marker } }),
      );
    if (changed && marker) onMarkerActivate?.({ ...marker });
    return true;
  }
  function setMarkers(markers: readonly MapMarker[]) {
    if (destroyed) return;
    const ids = new Set<string>();
    const next = markers.map((marker) => {
      if (typeof marker.id !== 'string' || !marker.id || ids.has(marker.id))
        throw new RangeError('Markers require unique nonempty IDs.');
      ids.add(marker.id);
      return { marker: { ...marker }, point: map.project([marker.lng, marker.lat]) };
    });
    const previous = selectedMarker;
    markerLayer.replaceChildren();
    markerSelect.replaceChildren(element('option', 'No marker selected'));
    markerSelect.options[0].value = '';
    markerItems = next.map(({ marker, point }) => {
      const node = svgElement('g', {
        transform: `translate(${point[0]},${point[1]})`,
        'data-marker-id': marker.id,
        role: 'button',
        tabindex: 0,
        'aria-label': marker.label ?? marker.id,
        'aria-pressed': 'false',
      });
      const hit = svgElement('circle', { fill: 'transparent', 'pointer-events': 'all' });
      const dot = svgElement('circle', {
        fill: marker.color ?? markerColor,
        stroke: '#fff9e9',
        'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
      });
      const title = svgElement('title');
      title.textContent = marker.label ?? marker.id;
      node.append(title, hit, dot);
      markerLayer.append(node);
      const option = element('option', marker.label ?? marker.id);
      option.value = marker.id;
      markerSelect.append(option);
      return { marker, point, node, dot, hit };
    });
    markerLabel.hidden = !markerItems.length;
    if (markerLabel.firstChild)
      markerLabel.firstChild.textContent = `Choose marker (${markerItems.length})`;
    const nextSelection =
      previous && ids.has(previous)
        ? previous
        : (markers.find((marker) => marker.selected)?.id ?? null);
    selectMarker(nextSelection, { fit: false });
  }
  function setMode(next: ExplorerMode) {
    if (destroyed) return;
    if (!['neighborhoods', 'districts', 'basemap'].includes(next))
      throw new RangeError(`Unknown map mode: ${next}`);
    mode = next;
    modeSelect.value = mode;
    root.dataset.mode = mode;
    root.setAttribute('aria-label', 'San Francisco interactive map');
    svg.setAttribute(
      'aria-label',
      `${mode === 'districts' ? 'District' : 'Neighborhood'} map. Use map controls to explore.`,
    );
    const districts = mode !== 'neighborhoods';
    for (const node of [sourceLabel, searchLabel, count, results]) node.hidden = districts;
    updateComposition();
    updateDetail();
    resetView();
    status.textContent =
      mode === 'basemap'
        ? 'San Francisco basemap.'
        : districts
          ? `${year} supervisorial districts. Numbers identify each district.`
          : selected
            ? `${selected.properties.canonicalName} selected. ${sourceNames[source]}.`
            : `${sourceNames[source]}. Select a neighborhood to begin.`;
  }
  function setLabels(visible: boolean) {
    if (destroyed) return;
    if (typeof visible !== 'boolean') throw new TypeError('Labels must be a boolean.');
    labels = visible;
    labelsButton.setAttribute('aria-pressed', String(labels));
    root.dataset.labels = String(labels);
    updateComposition();
    if (!labels) {
      labelLayer.replaceChildren();
      root.dataset.visibleLabels = '0';
    }
    scheduleLabels();
  }
  listen(modeSelect, 'change', () => {
    const next = modeSelect.value;
    if (next === 'neighborhoods' || next === 'districts' || next === 'basemap') setMode(next);
  });
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
  const touchButton = button('Touch navigation', 'Enable map touch navigation', () =>
    setTouchNavigation(!touchNavigation),
  );
  let touchNavigation = false;
  const navigation = attachNavigation(svg, getViewport, setView, controller.signal, () =>
    setTouchNavigation(false),
  );
  function setTouchNavigation(enabled: boolean) {
    if (destroyed) return;
    if (typeof enabled !== 'boolean') throw new TypeError('Touch navigation must be a boolean.');
    touchNavigation = enabled;
    navigation.setTouchNavigation(enabled);
    canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
    touchButton.textContent = enabled ? 'Done: page scrolling' : 'Touch navigation';
    touchButton.setAttribute(
      'aria-label',
      enabled ? 'Exit map touch navigation' : 'Enable map touch navigation',
    );
    touchButton.setAttribute('aria-pressed', String(enabled));
    root.dataset.touchNavigation = String(enabled);
  }
  listen(neighborhoodSelect, 'change', () => selectNeighborhood(neighborhoodSelect.value || null));
  listen(markerSelect, 'change', () => selectMarker(markerSelect.value || null));
  listen(svg, 'keydown', (event) => {
    const target = event.target instanceof SVGElement ? event.target : null;
    const id = target?.dataset.neighborhoodId;
    if (!id || !selectableNeighborhoods) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectNeighborhood(id);
      target.focus();
    } else if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      const i = items.findIndex((item) => item.feature.id === id);
      const next = items[(i + (event.key === ']' ? 1 : items.length - 1)) % items.length];
      for (const item of items) item.node.setAttribute('tabindex', item === next ? '0' : '-1');
      next.node.focus();
    }
  });
  listen(markerLayer, 'click', (event) => {
    const node =
      event.target instanceof Element ? event.target.closest<SVGElement>('[data-marker-id]') : null;
    if (node?.dataset.markerId) selectMarker(node.dataset.markerId);
  });
  listen(markerLayer, 'keydown', (event) => {
    const node =
      event.target instanceof Element ? event.target.closest<SVGElement>('[data-marker-id]') : null;
    if (node?.dataset.markerId && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectMarker(node.dataset.markerId);
      node.focus();
    }
  });
  listen(svg, 'click', (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest<SVGElement>('[data-neighborhood-id]')
        : null;
    if (selectableNeighborhoods && node?.dataset.neighborhoodId)
      selectNeighborhood(node.dataset.neighborhoodId);
  });
  const observer = new ResizeObserver(() => {
    navigation.cancel();
    scheduleLabels();
  });
  observer.observe(canvas);
  const explorer = Object.assign(root, {
    selectNeighborhood,
    getSelection,
    getViewport,
    setViewport: setView,
    fitGeometry,
    panBy,
    setTouchNavigation,
    setMarkers,
    selectMarker,
    getSelectedMarker,
    setSource,
    setMode,
    setLabels,
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
  try {
    const initialMode = mode;
    setSource(source);
    if (neighborhood !== undefined) selectNeighborhood(neighborhood);
    setMode(initialMode);
    if (initialMode === 'neighborhoods' && selected) {
      const selectedItem = items.find((item) => item.feature === selected);
      if (selectedItem) setView(fitBounds(selectedItem.bounds));
    }
    setLabels(labels);
    setTouchNavigation(false);
    setMarkers(initialMarkers);
  } catch (error) {
    explorer.destroy();
    throw error;
  }
  return explorer;
}
