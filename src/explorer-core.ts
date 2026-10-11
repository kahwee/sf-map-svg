import type { Bounds, NeighborhoodFeature, NeighborhoodSource } from '../data/types.js';
import { copyAppearance } from './appearance.js';
import { createCamera, validateCameraOptions } from './camera.js';
import { clusterPoints } from './clusters.js';
import type { MapAppearance, MapConfiguration } from './controller-types.js';
import { renderDistrictAppearance } from './district-layer.js';
import { createDistrictMorph } from './district-morph.js';
import { prepareDistrictStyles } from './district-style.js';
import { createDistrictTransition } from './district-transition.js';
import { element, setAttributeIfChanged, svgElement } from './dom.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { View } from './explorer-layout.js';
import { fitBounds, interiorAnchor, projectedBounds } from './explorer-layout.js';
import { controlKeys, layerKeys, normalizeFeatures, validateSwitchPatch } from './features.js';
import { createFrameScheduler } from './frame-scheduler.js';
import { geometryPath } from './geometry.js';
import { createLabelRenderer } from './label-renderer.js';
import { createLayerTransitions } from './layer-transition.js';
import {
  createSFMapWithData,
  districtColors,
  getLayerPathsWithData,
  resolveMapColors,
} from './map-core.js';
import { createMarkerChooser } from './marker-chooser.js';
import { createMarkerLayer, type MarkerItem } from './marker-layer.js';
import { createMarkerNavigation } from './marker-navigation.js';
import { attachNavigation } from './navigation.js';
import type {
  CameraOptions,
  DistrictSelection,
  DistrictYear,
  ExplorerMode,
  InteractiveLayers,
  MapFeatures,
  MapMarker,
  MapOverlay,
  MapViewport,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
  NeighborhoodSelection,
} from './types.js';
import { validateExplorerOptions, validateMarkers, validateOverlays } from './validation.js';
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
  level?: 'primary' | 'secondary';
}

const sourceNames: Record<NeighborhoodSource, string> = {
  realtor: 'SFAR realtor · 92 areas',
  'sf-find': 'SF Find · 117 areas',
  analysis: 'City analysis · 41 areas',
};
const normalizeName = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const formatSourceLabel = (source: NeighborhoodSource) =>
  sourceNames[source] ?? `${source} neighborhoods`;

/** Private bridge between the renderer and its public lifecycle controller. */
type MapEngineElement = NeighborhoodExplorerElement & {
  applyPresentation(
    patch: MapConfiguration,
    onCommit?: () => void,
    isCurrent?: () => boolean,
  ): boolean;
  getMapState(): {
    mode: ExplorerMode;
    source: NeighborhoodSource;
    year: DistrictYear;
    labels: boolean;
  };
};

let explorerCount = 0;

/** Create an offline, browser-only neighborhood explorer. Call destroy() before disposal. */
export function createNeighborhoodExplorerCore(
  options: NeighborhoodExplorerOptions = {},
  data: InteractiveSFMapData,
): MapEngineElement {
  validateExplorerOptions(options);
  let {
    source = 'realtor',
    mode = 'neighborhoods',
    labels = true,
    neighborhood,
    year = 2022,
    theme = 'transit',
    colors = {},
    labelStyle = {},
    areaStyle = {},
    districtStyle: initialDistrictStyle,
    motion = false,
    markerEntrance = false,
    selectedMarkerRing,
    clustering = false,
    legend: legendOptions = {},
    attribution: attributionMode = 'full',
    northArrow = false,
    scaleBar = false,
    layerTransitions = false,
    districtMorph: districtMorphOption = false,
    interface: chrome = 'explorer',
    layers = {},
    selectableNeighborhoods = true,
    labelSize = {},
    fitPadding = 24,
    markers: initialMarkers = [],
    markerRadius = 6,
    markerHitSize = 44,
    markerColor = colors.marker ?? '#245b61',
    selectedMarkerColor = colors.selected ?? '#f04f32',
    onMarkerActivate,
    overlays: initialOverlays = [],
    onOverlayActivate,
    style: styleOptions = {},
    strings = {},
    controls = {},
  } = options;
  if (!['neighborhoods', 'districts', 'basemap'].includes(mode))
    throw new RangeError(`Unknown map mode: ${mode}`);
  if (chrome !== 'explorer' && chrome !== 'map') throw new RangeError('Unknown interface.');
  let minLabelSize = labelSize.min ?? 11,
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
  let features = normalizeFeatures({
    motion,
    markerEntrance,
    clustering,
    selectedMarkerRing,
    northArrow,
    scaleBar,
    layerTransitions,
    districtMorph: districtMorphOption,
  });
  if (
    labelStyle.fontWeight !== undefined &&
    (!Number.isFinite(labelStyle.fontWeight) ||
      labelStyle.fontWeight < 1 ||
      labelStyle.fontWeight > 1000)
  )
    throw new RangeError('Label font weight must be finite and between 1 and 1000.');
  validateSwitchPatch(controls, controlKeys);
  colors = { ...colors };
  labelStyle = { ...labelStyle };
  areaStyle = { ...areaStyle };
  strings = { ...strings };
  controls = { ...controls };
  if (typeof fitPadding === 'object') fitPadding = { ...fitPadding };
  validateSwitchPatch(layers, layerKeys);
  validateSwitchPatch(controls, controlKeys);
  layers = { ...layers };
  const enabled = (layer: keyof NonNullable<NeighborhoodExplorerOptions['layers']>) =>
    layers[layer] ??
    (layer.startsWith('district')
      ? mode === 'districts'
      : layer.startsWith('neighborhood')
        ? mode === 'neighborhoods'
        : true);
  if (typeof labels !== 'boolean') throw new TypeError('Labels must be a boolean.');
  const collections = data.neighborhoods;
  const sources = (['realtor', 'sf-find', 'analysis'] as const).filter((item) =>
    Object.hasOwn(collections, item),
  );
  if (options.source === undefined && sources.length && !Object.hasOwn(collections, source))
    source = sources[0];
  if (!Object.hasOwn(collections, source) && (sources.length || options.source !== undefined))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
  if (!sources.length && mode === 'neighborhoods')
    throw new RangeError('No neighborhood dataset was supplied.');
  if (neighborhood === '') neighborhood = undefined;
  const getNeighborhood = (name: string, selectedSource: NeighborhoodSource = source) => {
    const term = normalizeName(name);
    if (!term) return undefined;
    return collections[selectedSource]?.features.find((feature) =>
      [
        feature.id,
        feature.properties.canonicalName,
        feature.properties.sourceName,
        ...feature.properties.aliases,
      ].some((value) => normalizeName(value) === term),
    );
  };
  const searchNeighborhoods = (query: string, selectedSource: NeighborhoodSource) => {
    const term = normalizeName(query);
    return (collections[selectedSource]?.features ?? [])
      .filter((feature) =>
        [
          feature.id,
          feature.properties.canonicalName,
          feature.properties.sourceName,
          ...feature.properties.aliases,
        ].some((value) => normalizeName(value).includes(term)),
      )
      .map((feature) => ({ id: feature.id, canonicalName: feature.properties.canonicalName }));
  };
  if (neighborhood !== undefined && !getNeighborhood(neighborhood, source))
    throw new RangeError(`Unknown neighborhood: ${neighborhood}`);
  if (typeof document === 'undefined')
    throw new Error('The neighborhood explorer requires a browser document.');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
.sf-explorer{container:sf-neighborhood-explorer / inline-size;font:14px/1.5 var(--sf-map-font);color:var(--sf-map-ink);background:var(--sf-map-surface);border:1px solid var(--sf-map-border);border-radius:14px;overflow:hidden;max-width:1120px;margin:auto;box-shadow:0 8px 32px #18364f08}
.sf-explorer *{box-sizing:border-box}
.sf-explorer [hidden]{display:none!important}
.sf-explorer h2,.sf-explorer p{margin:0}
.sf-explorer button,.sf-explorer input,.sf-explorer select,.sf-explorer a{font:inherit}
.sf-explorer button,.sf-explorer select,.sf-explorer input{color:inherit;border:1px solid #c7d5df;border-radius:7px;background:var(--sf-map-surface);min-height:44px;padding:9px 12px}
.sf-explorer button{cursor:pointer;transition:background .12s,border-color .12s}
.sf-explorer button:hover{background:#f0f6fa;border-color:#8ba9c0}
.sf-explorer button[aria-pressed=true]{color:#123d63;background:#e6f1f9;border-color:#5689b0;font-weight:650}
.sf-explorer :focus-visible{outline:3px solid var(--sf-map-focus);outline-offset:2px}
.sf-explorer-header{padding:24px;border-top:4px solid var(--sf-map-accent);border-bottom:1px solid var(--sf-map-border)}
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
.sf-explorer-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sf-map-control-gap);padding:12px;background:var(--sf-map-surface);border-bottom:1px solid var(--sf-map-border)}
.sf-explorer-control-group{display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%}
.sf-explorer-pan-controls{margin-left:auto}
.sf-explorer-toolbar button{min-width:44px;padding:6px 10px}
.sf-explorer-zoom{font-size:12px;min-width:42px;text-align:center;font-variant-numeric:tabular-nums;color:#496578}
.sf-explorer-canvas{position:relative;aspect-ratio:1;overflow:hidden;touch-action:pan-y pinch-zoom}
.sf-marker-chooser{position:absolute;z-index:2;top:12px;right:12px;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;width:280px;max-width:calc(100% - 24px);max-height:calc(100% - 24px);overflow:auto;padding:12px;border:1px solid var(--sf-map-border);border-radius:8px;background:var(--sf-map-surface);color:var(--sf-map-ink);box-shadow:0 6px 20px #0003}
.sf-marker-chooser button{min-height:44px;text-align:left;overflow-wrap:anywhere}
.sf-explorer-canvas>svg{display:block;width:100%;height:100%;max-width:none;cursor:grab;user-select:none}
.sf-explorer-canvas>svg:active{cursor:grabbing}
.sf-explorer-canvas path[data-neighborhood-id]{cursor:pointer}
.sf-explorer-legend{display:flex;flex-wrap:wrap;gap:8px 20px;padding:14px 16px 8px;background:var(--sf-map-surface);border-top:1px solid #dce5eb;color:#496578;font-size:12px}
.sf-explorer-legend-item{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.sf-explorer-legend-symbol{display:inline-block;flex:none;width:15px;height:11px;border-radius:2px}
.sf-explorer-legend-bart{width:10px;height:10px;margin:0 2px;border:2px solid #0073ae;border-radius:50%;background:#fff}
.sf-explorer-legend-park{background:#c6dfbd;border:1px solid #a8c69d}
.sf-explorer-legend-road{height:2px;border-radius:2px;background:#bcc3c5}
.sf-explorer-legend-highway{height:3px;border-radius:2px;background:#b9a18a}
.sf-explorer-hint{padding:6px 16px 10px;font-size:12px;color:#586f80;background:#fff}
.sf-explorer text{pointer-events:none}
.sf-explorer-status{padding:0 16px 14px;font-size:12px;background:var(--sf-map-surface);color:#496578}
.sf-explorer-visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
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
  root.style.setProperty('--sf-map-ink', styleOptions.ink ?? '#18364f');
  root.style.setProperty('--sf-map-surface', styleOptions.surface ?? '#fff');
  root.style.setProperty('--sf-map-accent', styleOptions.accent ?? '#163d61');
  root.style.setProperty('--sf-map-border', styleOptions.border ?? '#cedae3');
  root.style.setProperty('--sf-map-focus', styleOptions.focus ?? '#1676b8');
  root.style.setProperty('--sf-map-control-gap', styleOptions.controlGap ?? '6px');
  root.style.setProperty('--sf-map-font', styleOptions.font ?? 'system-ui,sans-serif');
  root.append(style);
  const header = element('header', '', 'sf-explorer-header');
  header.append(
    element('h2', strings.title ?? 'Explore San Francisco'),
    element('p', 'Explore the city, from familiar names to the places in between.'),
  );
  root.append(header);
  const body = element('div', '', 'sf-explorer-body');
  const panel = element('div', '', 'sf-explorer-panel');
  const modeLabel = element('label', strings.mode ?? 'Map mode');
  const modeSelect = element('select');
  for (const [value, title] of [
    ['neighborhoods', 'Neighborhoods'],
    ['districts', 'Districts'],
    ['basemap', 'Basemap'],
  ] as const) {
    if (value === 'districts' && !data.districts?.[year]) continue;
    if (value === 'neighborhoods' && !sources.length) continue;
    const option = element('option', title);
    option.value = value;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
  const sourceLabel = element('label', strings.source ?? 'Neighborhood definitions');
  const sourceSelect = element('select');
  for (const value of sources) {
    const title = sourceNames[value];
    const option = element('option', title);
    option.value = value;
    sourceSelect.append(option);
  }
  sourceSelect.value = source;
  sourceLabel.append(sourceSelect);
  const searchLabel = element('label', strings.search ?? 'Find a neighborhood');
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
    strings.gestureHelp ??
      'Drag to pan · Ctrl/⌘ + scroll to zoom · Focus map: arrows pan, +/− zoom, Home resets. Touch: scroll the page, or enable Touch navigation to pan and pinch the map. Escape exits.',
    'sf-explorer-hint',
  );
  hint.id = `sf-explorer-help-${++explorerCount}`;
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
    if (legendOptions.builtins === false || legendOptions.hidden?.includes(kind)) continue;
    const entry = element('span', '', 'sf-explorer-legend-item');
    const symbol = element('span', '', `sf-explorer-legend-symbol sf-explorer-legend-${kind}`);
    symbol.setAttribute('aria-hidden', 'true');
    if (colors[kind]) {
      if (kind === 'bart') symbol.style.borderColor = colors[kind];
      else symbol.style.backgroundColor = colors[kind];
    }
    entry.append(symbol, document.createTextNode(label));
    legend.append(entry);
  }
  for (const item of legendOptions.items ?? []) {
    const entry = element('span', '', 'sf-explorer-legend-item');
    const symbol = element('span', '', 'sf-explorer-legend-symbol');
    symbol.style.backgroundColor = item.color;
    symbol.setAttribute('aria-hidden', 'true');
    entry.append(symbol, document.createTextNode(item.label));
    legend.append(entry);
  }
  const featureControls = element('div', '', 'sf-explorer-feature-controls');
  const neighborhoodLabel = element('label', strings.chooseNeighborhood ?? 'Select neighborhood');
  const neighborhoodSelect = element('select');
  neighborhoodLabel.append(neighborhoodSelect);
  const markerLabel = element('label', strings.chooseMarker ?? 'Choose marker');
  const markerSelect = element('select');
  markerLabel.append(markerSelect);
  featureControls.append(neighborhoodLabel, markerLabel);
  const attribution = element('p', '', 'sf-explorer-hint');
  const attributionDisclosure = element('details', '', 'sf-explorer-hint');
  attributionDisclosure.append(element('summary', 'Map data · DataSF / BART'), attribution);
  column.append(
    toolbar,
    featureControls,
    canvas,
    legend,
    hint,
    status,
    attributionMode === 'compact' ? attributionDisclosure : attribution,
  );
  body.append(panel, column, detail);
  root.append(body);
  const map = createSFMapWithData(
    {
      year,
      theme,
      colors,
      districtLabels: false,
      districtLines: true,
      districtFills: true,
      highways: true,
      keyRoads: true,
      roadLabels: false,
      landmarks: true,
      bartStations: false,
    },
    data.map,
  );
  canvas.innerHTML = map.svg;
  const renderedSvg = canvas.querySelector('svg');
  if (!renderedSvg) throw new Error('The renderer did not produce an SVG.');
  const svg = renderedSvg;
  const overlayElement = element('div', '', 'sf-map-overlay');
  overlayElement.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  canvas.append(overlayElement);
  const scale = element('span', '', 'sf-map-scale');
  scale.style.cssText =
    'position:absolute;bottom:12px;left:12px;border-bottom:2px solid currentColor;background:var(--sf-map-surface);text-align:center;white-space:nowrap;font:12px/1.5 system-ui,sans-serif';
  overlayElement.append(scale);
  const arrow = element('span', '↑ N', 'sf-map-north');
  arrow.setAttribute('aria-label', 'North');
  arrow.style.cssText =
    'position:absolute;top:12px;right:12px;padding:4px;background:var(--sf-map-surface)';
  overlayElement.append(arrow);
  function syncFurniture() {
    scale.hidden = !features.scaleBar;
    arrow.hidden = !features.northArrow;
  }
  syncFurniture();
  function projectToScreen(lng: number, lat: number) {
    const [x, y] = map.project([lng, lat]);
    const width = canvas.getBoundingClientRect().width;
    if (!width) throw new Error('Mount the map before projecting to screen.');
    const px = ((x - view[0]) * width) / view[2],
      py = ((y - view[1]) * width) / view[2];
    return { x: px, y: py, visible: px >= 0 && py >= 0 && px <= width && py <= width };
  }
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
  let districtItems: LabelItem[] = (data.districts?.[year]?.features ?? []).flatMap((feature) =>
    feature.properties.labelPoints.map((point) => ({
      point: map.project(point),
      name: String(feature.properties.district),
      kind: 'district',
    })),
  );
  const markerLayer = svgElement('g', { 'data-layer': 'interactive-markers' });
  const overlayLayer = svgElement('g', { 'data-layer': 'user-overlays' });
  const areas = svgElement('g', { 'data-layer': 'explorer-neighborhoods' });
  const stations = svgElement('g', { 'data-layer': 'explorer-bart' });
  const labelLayer = svgElement('g', {
    'data-layer': 'explorer-labels',
    'aria-hidden': 'true',
    'font-family': labelStyle.fontFamily ?? styleOptions.font ?? 'system-ui,sans-serif',
  });
  const labelRenderer = createLabelRenderer(labelLayer);
  geography.append(areas, stations, labelLayer, overlayLayer, markerLayer);
  let view: View = [0, 0, 800];
  let selected: NeighborhoodFeature | undefined;
  let selectedDistrict: number | null = null;
  let hoveredDistrict: number | null = null;
  let districtStyle = initialDistrictStyle;
  let districtStyles = prepareDistrictStyles(data.map.districts?.[year] ?? [], districtStyle);
  const districtTransition = createDistrictTransition();
  let districtRevision = 0;
  root.dataset.year = String(year);
  function districtRow(id: number) {
    return data.map.districts?.[year]?.find((district) => district.id === id);
  }
  function districtSelection(
    id: number | null,
  ): DistrictSelection | { id: null; year: DistrictYear; district: null } {
    const district = id === null ? undefined : districtRow(id);
    return district
      ? { id: district.id, year, district: structuredClone(district) }
      : { id: null, year, district: null };
  }
  function getSelectedDistrict(): DistrictSelection | null {
    return selectedDistrict === null
      ? null
      : (districtSelection(selectedDistrict) as DistrictSelection);
  }
  function updateDistrictAppearance() {
    renderDistrictAppearance({
      svg,
      rows: data.map.districts?.[year] ?? [],
      styles: districtStyles,
      selectedDistrict,
      hoveredDistrict,
      year,
      theme,
      colors,
      fills: enabled('districtFills'),
      lines: enabled('districtLines'),
    });
  }
  function selectDistrict(id: number | null, options: { fit?: boolean } & CameraOptions = {}) {
    if (destroyed) return false;
    validateCameraOptions(options);
    if (id !== null && (!Number.isInteger(id) || !districtRow(id))) return false;
    const changed = selectedDistrict !== id;
    const revision = ++districtRevision;
    selectedDistrict = id;
    if (id === null) delete root.dataset.selectedDistrict;
    else root.dataset.selectedDistrict = String(id);
    updateDistrictAppearance();
    const selectedRow = id === null ? undefined : districtRow(id);
    if (selectedRow && options.fit) fitGeometry(selectedRow.geometry, undefined, options);
    if (destroyed || revision !== districtRevision) return true;
    status.textContent =
      id === null ? 'District selection cleared.' : `District ${id} selected, ${year} boundaries.`;
    if (changed)
      root.dispatchEvent(
        new CustomEvent('districtchange', { bubbles: true, detail: districtSelection(id) }),
      );
    return true;
  }
  function activateDistrict(id: number) {
    const revision = districtRevision + 1;
    if (!selectDistrict(id) || destroyed || revision !== districtRevision) return false;
    root.dispatchEvent(
      new CustomEvent('districtactivate', { bubbles: true, detail: districtSelection(id) }),
    );
    return !destroyed && revision === districtRevision;
  }
  function setDistrictStyle(style: typeof districtStyle) {
    if (destroyed) return;
    const revision = districtRevision;
    const prepared = prepareDistrictStyles(data.map.districts?.[year] ?? [], style);
    if (destroyed || revision !== districtRevision) return;
    districtRevision++;
    districtStyle = style;
    districtStyles = prepared;
    const fills = districtLayers.find((layer) => layer.dataset.layer === 'district-fills');
    const fade = layerFades.duration();
    // A new style settles any fill crossfade still running from an earlier change.
    districtTransition.cancel();
    if (fills && fade && enabled('districtFills')) districtTransition.fade(fills, fade);
    updateDistrictAppearance();
  }
  function setDistrictYear(
    next: DistrictYear,
    options: CameraOptions = {},
    preparedStyles?: ReturnType<typeof prepareDistrictStyles>,
  ) {
    if (destroyed) return;
    validateCameraOptions(options);
    if (![2002, 2012, 2022].includes(next))
      throw new RangeError('District year must be 2002, 2012, or 2022.');
    if (!data.map.districts?.[next] || !data.districts?.[next])
      throw new RangeError(`No ${next} district dataset was supplied.`);
    if (next === year) return;
    const revision = districtRevision;
    const prepared =
      preparedStyles ?? prepareDistrictStyles(data.map.districts[next], districtStyle);
    if (destroyed || revision !== districtRevision) return;
    const committedRevision = ++districtRevision;
    const geometry = getLayerPathsWithData({ year: next }, data.map, false);
    const previousYear = year;
    districtTransition.cancel();
    districtMorph.stop();
    const lineLayer = districtLayers.find((layer) => layer.dataset.layer === 'district-lines');
    const morph =
      features.districtMorph &&
      options.animate !== false &&
      initialized &&
      !reducedMotion.matches &&
      (enabled('districtLines') || enabled('districtFills'))
        ? features.districtMorph
        : false;
    const previousOutlines =
      morph && lineLayer
        ? new Map(
            [...lineLayer.querySelectorAll<SVGPathElement>('path[data-district]')].map((path) => [
              path.dataset.district ?? '',
              path.getAttribute('d') ?? '',
            ]),
          )
        : undefined;
    for (const layer of districtLayers) {
      if (morph) {
        // The morph replaces the line crossfade; fills fade across the whole morph.
        if (layer !== lineLayer) districtTransition.fade(layer, morph.duration);
      } else if (options.animate && !reducedMotion.matches)
        districtTransition.fade(layer, options.duration ?? 280);
      layer.replaceChildren(
        ...geometry.districts.map((district) =>
          svgElement('path', {
            'data-district': district.id,
            d: district.path,
            ...(layer.dataset.layer === 'district-fills'
              ? { 'fill-rule': 'evenodd' }
              : { fill: 'none', 'stroke-width': 1.1 }),
          }),
        ),
      );
    }
    year = next;
    districtStyles = prepared;
    hoveredDistrict = null;
    root.dataset.year = String(year);
    svg.dataset.year = String(year);
    districtItems = (data.districts[next]?.features ?? []).flatMap((feature) =>
      feature.properties.labelPoints.map((point) => ({
        point: map.project(point),
        name: String(feature.properties.district),
        kind: 'district',
      })),
    );
    if (selectedDistrict !== null && !districtRow(selectedDistrict)) selectedDistrict = null;
    if (selectedDistrict === null) delete root.dataset.selectedDistrict;
    updateDistrictAppearance();
    updateComposition();
    if (morph && lineLayer && previousOutlines)
      districtMorph.start(lineLayer, previousOutlines, {
        duration: morph.duration,
        stroke: colors.district ?? '#71838a',
      });
    scheduleLabels();
    status.textContent = `${year} supervisorial districts.`;
    root.dispatchEvent(
      new CustomEvent('districtyearchange', { bubbles: true, detail: { year, previousYear } }),
    );
    if (!destroyed && committedRevision === districtRevision && selectedDistrict !== null)
      root.dispatchEvent(
        new CustomEvent('districtchange', {
          bubbles: true,
          detail: districtSelection(selectedDistrict),
        }),
      );
  }
  updateDistrictAppearance();
  let items: NeighborhoodItem[] = [];
  let destroyed = false;
  let initialized = false;
  const layerFades = createLayerTransitions(() =>
    initialized && features.layerTransitions && !reducedMotion.matches
      ? features.layerTransitions.duration
      : 0,
  );
  const districtMorph = createDistrictMorph();
  const frames = createFrameScheduler({
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
    render: drawLabels,
  });
  const markerRenderer = createMarkerLayer(markerLayer);
  const cancelEntrances = markerRenderer.cancelEntrances;
  const camera = createCamera({
    read: getViewport,
    write: setView,
    duration: () => (initialized && features.motion ? features.motion.duration : 0),
    reduced: () => reducedMotion.matches,
    request: frames.request,
    cancel: frames.cancel,
    now: () => performance.now(),
  });
  const stopAnimation = camera.stop;
  const moveView = camera.move;
  function getFeatures(): MapFeatures {
    return structuredClone(features);
  }
  function setFeatures(patch: MapFeatures) {
    if (destroyed) return;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw new TypeError('Features must be an options object.');
    const next = normalizeFeatures({ ...features, ...patch });
    features = next;
    if (Object.hasOwn(patch, 'motion')) stopAnimation();
    if (Object.hasOwn(patch, 'markerEntrance')) cancelEntrances();
    if (Object.hasOwn(patch, 'layerTransitions')) {
      layerFades.cancel();
      districtTransition.cancel();
    }
    if (Object.hasOwn(patch, 'districtMorph')) districtMorph.stop();
    if (Object.hasOwn(patch, 'clustering')) invalidateClusters();
    syncFurniture();
    for (const item of markerItems) {
      const ring = features.selectedMarkerRing;
      item.ring.setAttribute(
        'display',
        ring && item.marker.id === selectedMarker ? 'inline' : 'none',
      );
      item.ring.setAttribute(
        'stroke',
        ring ? (ring.color ?? selectedMarkerColor) : selectedMarkerColor,
      );
      item.ring.setAttribute('stroke-width', String(ring ? ring.width : 2));
    }
    scheduleLabels();
  }
  const downloads = new Set<string>();
  const stationItems = (data.map.bartStations ?? []).map((feature) => {
    return {
      point: map.project(feature.coordinates),
      name: feature.name,
      kind: 'bart',
      node: svgElement('circle'),
    };
  });
  for (const station of stationItems) {
    station.node = svgElement('circle', {
      cx: station.point[0],
      cy: station.point[1],
      fill: '#fff',
      stroke: colors.bart ?? '#0073ae',
      'stroke-width': 2,
      'vector-effect': 'non-scaling-stroke',
    });
    const title = svgElement('title');
    title.textContent = `${station.name} BART station`;
    station.node.append(title);
    stations.append(station.node);
  }
  const roadItems = (data.map.keyRoads ?? []).map((feature) => ({
    point: map.project(feature.label),
    name: feature.name,
    level: feature.level ?? 'primary',
    kind: 'road',
  }));
  const parkItems = (data.map.landmarks ?? []).map((feature) => ({
    point: map.project(feature.label),
    name: feature.name,
    kind: 'park',
  }));
  let markerItems: MarkerItem[] = [];
  let selectedMarker: string | null = null;
  const markerNavigation = createMarkerNavigation(svg, controller.signal);
  const markerChooser = createMarkerChooser(canvas, svg, (id) => {
    if (destroyed) return;
    selectMarker(id);
    if (!destroyed && selectedMarker === id)
      markerItems.find((item) => item.marker.id === id)?.node.focus({ preventScroll: true });
  });
  let markerRevision = 0;
  let neighborhoodRevision = 0;
  const clusterLayer = svgElement('g', { 'data-layer': 'marker-clusters' });
  geography.insertBefore(clusterLayer, markerLayer);
  let clusterSignature = '';
  let clusterEvents = new AbortController();
  interface MarkerCluster {
    items: MarkerItem[];
    point: [number, number];
    node: SVGGElement | undefined;
  }
  let clusterCache:
    | {
        unit: number;
        revision: number;
        focused: string | undefined;
        clusters: MarkerCluster[];
        singles: MarkerItem[];
      }
    | undefined;
  let renderedMarkers: MarkerItem[] = [];
  let renderedClusters: MarkerCluster[] = [];
  function invalidateClusters() {
    markerChooser.close();
    clusterEvents.abort();
    clusterEvents = new AbortController();
    clusterSignature = '';
    clusterCache = undefined;
    if (clusterLayer.contains(document.activeElement)) svg.focus({ preventScroll: true });
    clusterLayer.replaceChildren();
  }
  function drawClusters(unit: number) {
    const active = document.activeElement;
    const hadClusterFocus = clusterLayer.contains(active);
    const focused = active instanceof SVGElement ? active.dataset.markerId : undefined;
    if (
      !clusterCache ||
      clusterCache.unit !== unit ||
      clusterCache.revision !== markerRevision ||
      clusterCache.focused !== focused
    ) {
      const groups = features.clustering
        ? clusterPoints(
            markerItems.filter((item) => item.marker.id !== selectedMarker && item.node !== active),
            unit,
            features.clustering.radius,
          ).filter((group) => group.length > 1)
        : [];
      const signature = JSON.stringify(groups.map((group) => group.map((item) => item.marker.id)));
      const previous = clusterCache?.clusters;
      const unchanged = signature === clusterSignature;
      if (!unchanged) {
        clusterEvents.abort();
        clusterEvents = new AbortController();
        if (hadClusterFocus) svg.focus({ preventScroll: true });
        clusterLayer.replaceChildren();
        clusterSignature = signature;
      }
      const grouped = new Set(groups.flat());
      clusterCache = {
        unit,
        revision: markerRevision,
        focused,
        singles: markerItems.filter((item) => !grouped.has(item)),
        clusters: groups.map((items, index) => ({
          items,
          point: [
            items.reduce((sum, item) => sum + item.point[0], 0) / items.length,
            items.reduce((sum, item) => sum + item.point[1], 0) / items.length,
          ],
          node: unchanged ? previous?.[index]?.node : undefined,
        })),
      };
    }
    const intersects = (point: [number, number], pixels: number) => {
      const padding = pixels * unit;
      return (
        point[0] >= view[0] - padding &&
        point[0] <= view[0] + view[2] + padding &&
        point[1] >= view[1] - padding &&
        point[1] <= view[1] + view[2] + padding
      );
    };
    renderedMarkers = clusterCache.singles.filter(
      (item) =>
        item.node === active ||
        item.marker.id === selectedMarker ||
        intersects(
          item.point,
          Math.max(markerHitSize / 2, (item.marker.radius ?? markerRadius) + 6),
        ),
    );
    const mounted = new Set(renderedMarkers.map((item) => item.node));
    for (const node of Array.from(markerLayer.children))
      if (!mounted.has(node as SVGGElement)) node.remove();
    // Retain input order and stable nodes, with the selected pin above its peers.
    renderedMarkers.sort(
      (a, b) => Number(a.marker.id === selectedMarker) - Number(b.marker.id === selectedMarker),
    );
    renderedMarkers.forEach((item, index) => {
      setAttributeIfChanged(
        item.dot,
        'r',
        ((item.marker.radius ?? markerRadius) + (item.marker.id === selectedMarker ? 2 : 0)) * unit,
      );
      setAttributeIfChanged(
        item.hit,
        'r',
        Math.max(markerHitSize / 2, (item.marker.radius ?? markerRadius) + 4) * unit,
      );
      setAttributeIfChanged(
        item.ring,
        'r',
        ((item.marker.radius ?? markerRadius) +
          2 +
          (features.selectedMarkerRing ? features.selectedMarkerRing.gap : 3)) *
          unit,
      );
      if (markerLayer.children[index] !== item.node)
        markerLayer.insertBefore(item.node, markerLayer.children[index] ?? null);
    });
    if (active instanceof SVGGElement && mounted.has(active) && document.activeElement !== active)
      active.focus({ preventScroll: true });
    renderedClusters = clusterCache.clusters.filter(
      (cluster) => cluster.node === active || intersects(cluster.point, 26),
    );
    const visibleClusters = new Set(renderedClusters);
    for (const cluster of clusterCache.clusters)
      if (!visibleClusters.has(cluster)) cluster.node?.remove();
    for (const cluster of renderedClusters) {
      const group = cluster.items;
      if (!cluster.node) {
        const signal = clusterEvents.signal;
        const node = svgElement('g', {
          role: 'button',
          tabindex: -1,
          'data-cluster-ids': JSON.stringify(group.map((item) => item.marker.id)),
          'aria-label': `${group.length} places. Activate to explore or choose a place.`,
        });
        node.style.cursor = 'pointer';
        node.append(
          svgElement('circle', {
            fill: markerColor,
            stroke: '#fff',
            'stroke-width': 2,
            'vector-effect': 'non-scaling-stroke',
          }),
        );
        const text = svgElement('text', {
          fill: '#fff',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
        });
        text.textContent = String(group.length);
        node.append(text);
        const activate = () => {
          if (destroyed || signal.aborted) return;
          const markers = group.map((item) => ({ ...item.marker }));
          const minimumUnit = 800 / 12 / Math.max(1, canvas.getBoundingClientRect().width);
          if (
            clusterPoints(group, minimumUnit, features.clustering ? features.clustering.radius : 36)
              .length === 1
          )
            markerChooser.open(markers, node);
          else
            fitGeometry({
              type: 'MultiPoint',
              coordinates: markers.map((marker) => [marker.lng, marker.lat]),
            });
          if (destroyed || signal.aborted) return;
          root.dispatchEvent(
            new CustomEvent('clusteractivate', { bubbles: true, detail: { markers } }),
          );
        };
        node.addEventListener('click', activate, { signal });
        node.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate();
            }
          },
          { signal },
        );
        cluster.node = node;
      }
      const node = cluster.node;
      if (node.parentNode !== clusterLayer) clusterLayer.append(node);
      setAttributeIfChanged(
        node,
        'transform',
        `translate(${cluster.point[0]},${cluster.point[1]})`,
      );
      const circle = node.querySelector('circle');
      const text = node.querySelector('text');
      if (circle) setAttributeIfChanged(circle, 'r', 22 * unit);
      if (text) setAttributeIfChanged(text, 'font-size', 12 * unit);
    }
    markerNavigation.sync([
      ...renderedMarkers.map((item) => item.node),
      ...(Array.from(clusterLayer.children) as SVGElement[]),
    ]);
    if (hadClusterFocus && document.activeElement === svg) markerNavigation.recover();
  }
  let overlayEvents = new AbortController();
  function setOverlays(overlays: readonly MapOverlay[]) {
    if (destroyed) return;
    validateOverlays(overlays);
    const events = new AbortController();
    const next = overlays.map((input) => {
      const overlay = structuredClone(input);
      const node = svgElement('path', {
        'data-overlay-id': overlay.id,
        d: geometryPath(overlay.geometry, map.project),
        fill: overlay.fill ?? 'none',
        'fill-opacity': overlay.fillOpacity ?? 1,
        stroke: overlay.stroke ?? '#bd8b73',
        'stroke-width': overlay.strokeWidth ?? 2,
        'vector-effect': 'non-scaling-stroke',
        display: overlay.visible === false ? 'none' : 'inline',
        'pointer-events': 'none',
        ...(overlay.label ? { 'aria-label': overlay.label } : {}),
      });
      if (overlay.label) {
        node.setAttribute('role', 'img');
        const title = svgElement('title');
        title.textContent = overlay.label;
        node.append(title);
      }
      if (onOverlayActivate) {
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', overlay.visible === false ? '-1' : '0');
        node.setAttribute(
          'pointer-events',
          overlay.fill && overlay.fill !== 'none' ? 'visiblePainted' : 'stroke',
        );
        node.setAttribute('aria-label', overlay.label ?? overlay.id);
        const activate = () => {
          if (destroyed || events.signal.aborted) return;
          onOverlayActivate(structuredClone(overlay));
          if (destroyed || events.signal.aborted) return;
          root.dispatchEvent(
            new CustomEvent('overlayactivate', {
              bubbles: true,
              detail: { overlay: structuredClone(overlay) },
            }),
          );
        };
        node.addEventListener('click', activate, { signal: events.signal });
        node.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate();
            }
          },
          { signal: events.signal },
        );
      }
      return node;
    });
    overlayEvents.abort();
    overlayEvents = events;
    overlayLayer.replaceChildren(...next);
  }
  const zoomControls = element('div', '', 'sf-explorer-control-group');
  const panControls = element('div', '', 'sf-explorer-control-group sf-explorer-pan-controls');
  toolbar.append(zoomControls, panControls);
  function button(text: string, label: string, action: () => void, group = zoomControls) {
    const node = element('button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    listen(node, 'click', () => action());
    group.append(node);
    return node;
  }
  const zoomOut = button('−', 'Zoom out', () => zoomBy(1 / 1.5));
  const zoomText = element('span', '100%', 'sf-explorer-zoom');
  zoomControls.append(zoomText);
  const zoomIn = button('+', 'Zoom in', () => zoomBy(1.5));
  const resetButton = button(
    strings.reset ?? 'Reset',
    strings.reset ?? 'Reset map to city view',
    resetView,
  );
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
      () => moveView([view[0] + (dx * view[2]) / 4, view[1] + (dy * view[2]) / 4, view[2]]),
      panControls,
    );
  function panBy(x: number, y: number, options: CameraOptions = {}) {
    if (destroyed) return;
    if (![x, y].every(Number.isFinite))
      throw new RangeError('Pan offsets must be finite screen pixels.');
    validateCameraOptions(options);
    const width = canvas.getBoundingClientRect().width;
    if (!width) throw new Error('Mount the map in a visible container before panning.');
    moveView([view[0] + (x * view[2]) / width, view[1] + (y * view[2]) / width, view[2]], options);
  }
  function getViewport(): MapViewport {
    return [...view];
  }
  function fitGeometry(
    geometry: import('../data/types.js').Geometry,
    padding = fitPadding,
    options: CameraOptions = {},
  ) {
    if (destroyed) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) throw new Error('Mount the map in a visible container before fitting geometry.');
    moveView(fitViewport(projectedBounds(geometry, map.project), width, padding), options);
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
  function zoomBy(factor: number, options: CameraOptions = {}) {
    if (destroyed) return;
    if (!Number.isFinite(factor) || factor <= 0)
      throw new RangeError('Zoom factor must be positive and finite.');
    const size = Math.max(800 / 12, Math.min(800, view[2] / factor));
    moveView([view[0] + (view[2] - size) / 2, view[1] + (view[2] - size) / 2, size], options);
  }
  function resetView(options: CameraOptions = {}) {
    moveView([0, 0, 800], options);
  }
  function scheduleLabels() {
    if (destroyed) return;
    frames.invalidate();
  }
  function drawLabels() {
    if (destroyed) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const unit = view[2] / width,
      zoom = 800 / view[2];
    for (const road of svg.querySelectorAll<SVGPathElement>('[data-key-road-level="secondary"]'))
      road.style.display = zoom >= 1.8 ? '' : 'none';
    for (const station of stationItems) setAttributeIfChanged(station.node, 'r', 4.5 * unit);
    drawClusters(unit);
    if (features.scaleBar) {
      const a = map.project([-122.45, 37.76]),
        b = map.project([-122.44, 37.76]);
      const pixelsPerMeter = Math.abs(b[0] - a[0]) / unit / 879;
      const base = 10 ** Math.floor(Math.log10(100 / pixelsPerMeter));
      const meters =
        [5, 2, 1].map((factor) => factor * base).find((value) => value * pixelsPerMeter <= 100) ??
        base;
      scale.style.width = `${meters * pixelsPerMeter}px`;
      scale.textContent = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
    }
    if (!labels) {
      labelRenderer.clear();
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
    if (enabled('bartStations') && zoom >= 1.8) candidates.push(...stationItems);
    candidates.push(
      ...(enabled('landmarks') ? parkItems : []).filter(
        (park) =>
          zoom >= 1.8 ||
          park.name === 'Golden Gate Park' ||
          (width >= 550 && park.name === 'Presidio'),
      ),
    );
    candidates.push(
      ...(enabled('roadLabels') ? roadItems : []).filter(
        (road) => road.level === 'primary' || zoom >= 1.8,
      ),
    );
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
    const labelCandidates = candidates.map((item) => {
      const fontSize =
        item.kind === 'road'
          ? Math.max(minLabelSize, Math.min(11, maxLabelSize))
          : Math.max(minLabelSize, Math.min(maxLabelSize, 12));
      return {
        ...item,
        fontSize,
        fontWeight:
          labelStyle.fontWeight ??
          (item.kind.startsWith('selected') || item.kind === 'district' ? 700 : 550),
        fill:
          colors.label ??
          (item.kind === 'park'
            ? (colors.landmark ?? '#426641')
            : item.kind === 'road'
              ? '#77736b'
              : '#163d61'),
        halo: labelStyle.haloColor ?? '#ffffff',
        offset:
          item.kind === 'selected-marker'
            ? (marker?.marker.radius ?? markerRadius) + 9
            : item.kind === 'bart'
              ? 11
              : 0,
      };
    });
    const stationBounds: Bounds[] = (enabled('bartStations') ? stationItems : []).map(
      ({ point }) => {
        const x = (point[0] - view[0]) / unit;
        const y = (point[1] - view[1]) / unit;
        return [x - 6, y - 6, x + 6, y + 6];
      },
    );
    const markerBounds: Bounds[] = renderedMarkers.map(({ point, marker }) => {
      const radius = marker.radius ?? markerRadius;
      const x = (point[0] - view[0]) / unit,
        y = (point[1] - view[1]) / unit;
      return [x - radius - 3, y - radius - 3, x + radius + 3, y + radius + 3];
    });
    const canvasBox = canvas.getBoundingClientRect();
    const furnitureBounds: Bounds[] = [...overlayElement.children]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const box = node.getBoundingClientRect();
        return [
          box.left - canvasBox.left - 3,
          box.top - canvasBox.top - 3,
          box.right - canvasBox.left + 3,
          box.bottom - canvasBox.top + 3,
        ];
      });
    root.dataset.visibleLabels = String(
      labelRenderer.draw(labelCandidates, view, width, [
        ...stationBounds,
        ...markerBounds,
        ...furnitureBounds,
        ...renderedClusters.map(({ point }): Bounds => {
          const x = (point[0] - view[0]) / unit,
            y = (point[1] - view[1]) / unit;
          return [x - 26, y - 26, x + 26, y + 26];
        }),
      ]),
    );
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
      const collection = data.districts?.[year];
      if (!collection) {
        detail.append(element('h3', `${year} supervisorial districts`));
        return;
      }
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
    const collection = collections[source];
    if (!collection) return;
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
    const matches = searchNeighborhoods(search.value, source).sort((a, b) =>
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
        element(
          'p',
          strings.emptyResults ?? 'No matches. Try another name or definition source.',
          'sf-explorer-note',
        ),
      );
  }
  function getSelection(): NeighborhoodSelection | null {
    return selected
      ? {
          id: selected.id,
          name: selected.properties.canonicalName,
          source,
          feature: structuredClone(selected),
        }
      : null;
  }
  function selectNeighborhood(
    name: string | null,
    options: { fit?: boolean } & CameraOptions = {},
  ) {
    if (destroyed) return false;
    const feature =
      name === null
        ? undefined
        : (collections[source]?.features.find((entry) => entry.id === name) ??
          getNeighborhood(name, source));
    if (name !== null && !feature) return false;
    validateCameraOptions(options);
    const selectedItem = items.find((item) => item.feature === feature);
    const width = canvas.getBoundingClientRect().width;
    const target =
      selectedItem && options.fit !== false
        ? width
          ? fitViewport(selectedItem.bounds, width, fitPadding)
          : fitBounds(selectedItem.bounds)
        : null;
    if (
      feature &&
      !enabled('neighborhoodLines') &&
      !enabled('neighborhoodLabels') &&
      (layers.neighborhoodLines === undefined || layers.neighborhoodLabels === undefined)
    )
      setMode('neighborhoods', false);
    const revision = ++neighborhoodRevision;
    const changed = selected !== feature;
    selected = feature;
    for (const item of items) {
      const active = item.feature === selected;
      item.node.setAttribute(
        'fill',
        active ? (areaStyle.selectedFill ?? '#408dbe') : 'transparent',
      );
      item.node.setAttribute('fill-opacity', active ? '.16' : '1');
      item.node.setAttribute(
        'stroke',
        active ? (areaStyle.selectedStroke ?? '#176ba2') : (colors.neighborhood ?? '#9caebc'),
      );
      item.node.setAttribute(
        'stroke-width',
        active ? '2.2' : enabled('neighborhoodLines') ? '.55' : '0',
      );
      if (selectableNeighborhoods) item.node.setAttribute('aria-pressed', String(active));
      if (active) areas.append(item.node);
    }
    if (feature) root.dataset.selectedNeighborhood = feature.id;
    else delete root.dataset.selectedNeighborhood;
    neighborhoodSelect.value = feature?.id ?? '';
    scheduleLabels();
    updateResults();
    updateDetail();
    status.textContent = feature
      ? `${feature.properties.canonicalName} selected. ${formatSourceLabel(source)}.`
      : 'Neighborhood selection cleared.';
    if (changed)
      root.dispatchEvent(
        new CustomEvent('neighborhoodchange', {
          bubbles: true,
          detail: {
            feature: feature ? structuredClone(feature) : null,
            source,
            id: feature?.id ?? null,
            name: feature?.properties.canonicalName ?? null,
          },
        }),
      );
    if (!destroyed && neighborhoodRevision === revision && target) moveView(target, options);
    return true;
  }
  function prepareSource(next: NeighborhoodSource, reset = true) {
    if (!Object.hasOwn(collections, next))
      throw new RangeError(`Unknown neighborhood source: ${next}`);
    const collection = collections[next];
    if (
      !collection ||
      !Array.isArray(collection.features) ||
      typeof collection.title !== 'string' ||
      typeof collection.definition?.description !== 'string'
    )
      throw new TypeError(
        'Neighborhood collections require features, title and definition description.',
      );
    const ids = new Set<string>();
    const nextOptions: HTMLOptionElement[] = [];
    const nextItems = collection.features.map((feature) => {
      if (
        !feature ||
        typeof feature.id !== 'string' ||
        !feature.id ||
        ids.has(feature.id) ||
        !feature.properties ||
        typeof feature.properties.canonicalName !== 'string' ||
        typeof feature.properties.sourceName !== 'string' ||
        !Array.isArray(feature.properties.aliases) ||
        Array.from(feature.properties.aliases).some((alias) => typeof alias !== 'string') ||
        !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)
      )
        throw new TypeError(
          'Neighborhood features require unique IDs, names, aliases and polygon geometry.',
        );
      ids.add(feature.id);
      const bounds = projectedBounds(feature.geometry, map.project);
      if (!bounds.every(Number.isFinite))
        throw new RangeError('Neighborhood geometry must be nonempty and finite.');
      const node = svgElement('path', {
        d: geometryPath(feature.geometry, map.project),
        'data-neighborhood-id': feature.id,
        fill: 'transparent',
        'fill-rule': 'evenodd',
        stroke: colors.neighborhood ?? '#9caebc',
        'stroke-width': '.55',
        'vector-effect': 'non-scaling-stroke',
        role: 'button',
        tabindex: -1,
        'aria-label': feature.properties.canonicalName,
        'aria-pressed': 'false',
      });
      const option = element('option', feature.properties.canonicalName);
      option.value = feature.id;
      nextOptions.push(option);
      const title = svgElement('title');
      title.textContent = feature.properties.canonicalName;
      node.append(title);
      node.addEventListener('pointerenter', () => {
        if (
          destroyed ||
          !selectableNeighborhoods ||
          selected?.id === feature.id ||
          (!areaStyle.hoverFill && !areaStyle.hoverStroke)
        )
          return;
        node.setAttribute('fill', areaStyle.hoverFill ?? '#408dbe');
        node.setAttribute('fill-opacity', '.12');
        node.setAttribute('stroke', areaStyle.hoverStroke ?? colors.neighborhood ?? '#176ba2');
      });
      node.addEventListener('pointerleave', () => {
        if (destroyed || selected?.id === feature.id) return;
        node.setAttribute('fill', 'transparent');
        node.setAttribute('fill-opacity', '1');
        node.setAttribute('stroke', colors.neighborhood ?? '#9caebc');
      });
      return {
        feature,
        node,
        bounds,
        point: interiorAnchor(feature.geometry, map.project),
        area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]),
      };
    });
    return () => {
      const hadSelection = !!selected;
      source = next;
      sourceSelect.value = source;
      selected = undefined;
      const revision = ++neighborhoodRevision;
      delete root.dataset.selectedNeighborhood;
      root.dataset.source = source;
      layerFades.crossfade(areas, () =>
        areas.replaceChildren(...nextItems.map((item) => item.node)),
      );
      neighborhoodSelect.replaceChildren(element('option', 'No neighborhood selected'));
      neighborhoodSelect.options[0].value = '';
      neighborhoodSelect.append(...nextOptions);
      items = nextItems;
      if (items[0]) items[0].node.setAttribute('tabindex', '0');
      updateResults();
      updateDetail();
      updateComposition();
      status.textContent =
        mode === 'basemap'
          ? 'San Francisco basemap.'
          : mode === 'districts'
            ? `${year} supervisorial districts. Numbers identify each district.`
            : `${formatSourceLabel(source)}. Select a neighborhood to begin.`;
      if (hadSelection)
        root.dispatchEvent(
          new CustomEvent('neighborhoodchange', {
            bubbles: true,
            detail: { feature: null, source, id: null, name: null },
          }),
        );
      if (reset && !destroyed && neighborhoodRevision === revision) resetView();
    };
  }
  function setSource(next: NeighborhoodSource) {
    if (!destroyed) prepareSource(next)();
  }
  function syncFeatureControls() {
    featureControls.hidden = neighborhoodLabel.hidden && markerLabel.hidden;
  }
  function setLayers(patch: InteractiveLayers) {
    if (destroyed) return;
    validateSwitchPatch(patch, layerKeys);
    const next = { ...layers, ...patch };
    layers = next;
    updateComposition();
  }
  function updateComposition() {
    for (const [name, key] of [
      ['landmarks', 'landmarks'],
      ['highways', 'highways'],
      ['key-roads', 'keyRoads'],
    ] as const) {
      const layer = svg.querySelector<SVGElement>(`[data-layer="${name}"]`);
      if (layer) layerFades.set(layer, enabled(key));
    }
    layerFades.set(stations, enabled('bartStations'));
    for (const [kind, key] of [
      ['bart', 'bartStations'],
      ['park', 'landmarks'],
      ['road', 'keyRoads'],
      ['highway', 'highways'],
    ] as const) {
      const entry = legend.querySelector<HTMLElement>(`.sf-explorer-legend-${kind}`)?.parentElement;
      if (entry) entry.hidden = !enabled(key);
    }
    legend.hidden =
      controls.legend === false ||
      ![...legend.children].some((node) => !(node as HTMLElement).hidden);

    const neighborhoodsVisible =
      enabled('neighborhoodLines') || (labels && enabled('neighborhoodLabels'));
    layerFades.set(areas, neighborhoodsVisible);
    areas.style.pointerEvents = selectableNeighborhoods ? '' : 'none';
    neighborhoodLabel.hidden =
      !neighborhoodsVisible ||
      !selectableNeighborhoods ||
      chrome === 'explorer' ||
      controls.neighborhoodPicker === false;
    syncFeatureControls();
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
      layerFades.set(layer, enabled(key));
    }
    updateDistrictAppearance();
    const districtsVisible =
      enabled('districtFills') || enabled('districtLines') || (labels && enabled('districtLabels'));
    const descriptions = ['San Francisco map.'];
    if (districtsVisible) descriptions.push(`${year} supervisorial districts, DataSF.`);
    if (neighborhoodsVisible) {
      const collection = collections[source];
      if (collection)
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
      `${description} Arrow keys pan; plus and minus zoom; Home resets. Districts, neighborhoods, markers and clusters: brackets move focus; Enter selects. Coincident pins open a place chooser. The neighborhood and marker menus include every supplied item.`,
    );
    attribution.textContent = description;
    scheduleLabels();
  }
  function getSelectedMarker() {
    const marker = markerItems.find((item) => item.marker.id === selectedMarker)?.marker;
    return marker ? { ...marker } : null;
  }
  function selectMarker(id: string | null, options: { fit?: boolean } & CameraOptions = {}) {
    if (destroyed) return false;
    const item = markerItems.find((item) => item.marker.id === id);
    if (id !== null && !item) return false;
    validateCameraOptions(options);
    const width = canvas.getBoundingClientRect().width;
    const target =
      item && options.fit !== false
        ? width
          ? fitViewport([...item.point, ...item.point], width, fitPadding)
          : fitBounds([...item.point, ...item.point])
        : null;
    const revision = ++markerRevision;
    const changed = selectedMarker !== id;
    selectedMarker = id;
    if (changed) invalidateClusters();
    markerSelect.value = id ?? '';
    for (const entry of markerItems) {
      const active = entry.marker.id === id;
      const pressed = String(active);
      const ring = active && features.selectedMarkerRing ? 'inline' : 'none';
      const fill = active ? selectedMarkerColor : (entry.marker.color ?? markerColor);
      if (entry.node.getAttribute('aria-pressed') !== pressed)
        entry.node.setAttribute('aria-pressed', pressed);
      if (entry.ring.getAttribute('display') !== ring) entry.ring.setAttribute('display', ring);
      if (entry.dot.getAttribute('fill') !== fill) entry.dot.setAttribute('fill', fill);
      if (active && markerLayer.lastChild !== entry.node) markerLayer.append(entry.node);
    }
    scheduleLabels();
    if (width) drawClusters(view[2] / width);
    const marker = getSelectedMarker();
    if (changed)
      root.dispatchEvent(
        new CustomEvent('markerchange', { bubbles: true, detail: { id, marker } }),
      );
    if (!destroyed && changed && marker && markerRevision === revision && selectedMarker === id)
      onMarkerActivate?.({ ...marker });
    if (!destroyed && markerRevision === revision && target) moveView(target, options);
    return true;
  }
  function setMarkers(markers: readonly MapMarker[]) {
    if (destroyed) return;
    validateMarkers(markers);
    const existing = new Map(markerItems.map((item) => [item.marker.id, item]));
    const ids = new Set<string>();
    const next = markers.map((marker) => {
      ids.add(marker.id);
      const previous = existing.get(marker.id);
      const point =
        previous?.marker.lng === marker.lng && previous.marker.lat === marker.lat
          ? previous.point
          : map.project([marker.lng, marker.lat]);
      return { marker: { ...marker }, point };
    });
    const nextSelection =
      selectedMarker && ids.has(selectedMarker)
        ? selectedMarker
        : (markers.find((marker) => marker.selected)?.id ?? null);
    const keys = ['id', 'lng', 'lat', 'label', 'selected', 'color', 'radius'] as const;
    if (
      markerSelect.options.length > 0 &&
      nextSelection === selectedMarker &&
      next.length === markerItems.length &&
      next.every(({ marker }, index) =>
        keys.every((key) => marker[key] === markerItems[index].marker[key]),
      )
    )
      return;
    const focusedMarker = markerItems.find((item) => item.node === document.activeElement)?.marker
      .id;
    invalidateClusters();
    const options = new Map([...markerSelect.options].map((option) => [option.value, option]));
    for (const item of markerItems) {
      if (!ids.has(item.marker.id)) {
        markerRenderer.remove(item);
        options.get(item.marker.id)?.remove();
      }
    }
    if (!options.has('')) {
      const empty = element('option', 'No marker selected');
      empty.value = '';
      markerSelect.prepend(empty);
    }
    markerItems = next.map(({ marker, point }, index) => {
      const previous = existing.get(marker.id);
      const item =
        previous ??
        markerRenderer.add(marker, point, index, {
          features,
          markerColor,
          selectedMarkerColor,
          reducedMotion: reducedMotion.matches,
          enter: true,
        });
      if (previous) markerRenderer.update(item, marker, point, index);
      const option = options.get(marker.id) ?? element('option');
      const label = marker.label ?? marker.id;
      if (option.textContent !== label) option.textContent = label;
      if (option.value !== marker.id) option.value = marker.id;
      if (markerSelect.children[index + 1] !== option)
        markerSelect.insertBefore(option, markerSelect.children[index + 1] ?? null);
      return item;
    });
    markerLabel.hidden = !markerItems.length || controls.markerPicker === false;
    if (markerLabel.firstChild)
      markerLabel.firstChild.textContent = `${strings.chooseMarker ?? 'Choose marker'} (${markerItems.length})`;
    syncFeatureControls();
    const revision = markerRevision + 1;
    selectMarker(nextSelection, { fit: false });
    if (!destroyed && markerRevision === revision && focusedMarker) {
      markerNavigation.sync(markerItems.map((item) => item.node));
      if (!markerNavigation.recover()) {
        const recovery =
          markerItems.find((item) => item.marker.id === focusedMarker) ?? markerItems[0];
        if (recovery) {
          markerLayer.append(recovery.node);
          recovery.node.focus({ preventScroll: true });
          const width = canvas.getBoundingClientRect().width;
          if (width) drawClusters(view[2] / width);
        } else svg.focus({ preventScroll: true });
      }
    }
  }
  function setControls(patch: NonNullable<NeighborhoodExplorerOptions['controls']>) {
    if (destroyed) return;
    validateSwitchPatch(patch, controlKeys);
    const next = { ...controls, ...patch };
    controls = next;
    for (const node of [zoomIn, zoomOut, zoomText]) node.hidden = controls.zoom === false;
    panControls.hidden = controls.pan === false;
    resetButton.hidden = controls.reset === false;
    labelsButton.hidden = controls.labels === false;
    touchButton.hidden = controls.touch === false;
    if (touchButton.hidden && touchNavigation) setTouchNavigation(false);
    zoomControls.hidden = [...zoomControls.children].every((node) => (node as HTMLElement).hidden);
    toolbar.hidden = zoomControls.hidden && panControls.hidden;
    hint.hidden = controls.help === false;
    if (hint.hidden) svg.setAttribute('aria-describedby', hint.id);
    else svg.removeAttribute('aria-describedby');
    status.classList.toggle('sf-explorer-visually-hidden', controls.status === false);
    markerLabel.hidden = !markerItems.length || controls.markerPicker === false;
    updateComposition();
  }
  function setMode(next: ExplorerMode, reset = true) {
    if (destroyed) return;
    if (!['neighborhoods', 'districts', 'basemap'].includes(next))
      throw new RangeError(`Unknown map mode: ${next}`);
    if (next === 'neighborhoods' && !sources.length)
      throw new RangeError('No neighborhood dataset was supplied.');
    if (next === 'districts' && !data.districts?.[year])
      throw new RangeError(`No ${year} district dataset was supplied.`);
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
    status.textContent =
      mode === 'basemap'
        ? 'San Francisco basemap.'
        : districts
          ? `${year} supervisorial districts. Numbers identify each district.`
          : selected
            ? `${selected.properties.canonicalName} selected. ${formatSourceLabel(source)}.`
            : `${formatSourceLabel(source)}. Select a neighborhood to begin.`;
    if (reset) resetView();
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
      const exact = getNeighborhood(search.value, source);
      const matches = searchNeighborhoods(search.value, source);
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
  const touchLabel = strings.touchNavigation ?? 'Touch navigation';
  const touchButton = button(
    touchLabel,
    strings.touchNavigationLabel ?? `Enable ${touchLabel.toLowerCase()}`,
    () => setTouchNavigation(!touchNavigation),
  );
  touchButton.hidden = controls.touch === false;
  let touchNavigation = false;
  const navigation = attachNavigation(
    svg,
    getViewport,
    (next) => {
      stopAnimation();
      setView(next);
    },
    controller.signal,
    () => setTouchNavigation(false),
  );
  function setTouchNavigation(enabled: boolean) {
    if (destroyed) return;
    if (typeof enabled !== 'boolean') throw new TypeError('Touch navigation must be a boolean.');
    touchNavigation = enabled;
    navigation.setTouchNavigation(enabled);
    canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
    touchButton.textContent = enabled
      ? (strings.touchNavigationDone ?? 'Done: page scrolling')
      : touchLabel;
    touchButton.setAttribute(
      'aria-label',
      enabled
        ? (strings.touchNavigationExitLabel ?? `Exit ${touchLabel.toLowerCase()}`)
        : (strings.touchNavigationLabel ?? `Enable ${touchLabel.toLowerCase()}`),
    );
    touchButton.setAttribute('aria-pressed', String(enabled));
    root.dataset.touchNavigation = String(enabled);
  }
  listen(neighborhoodSelect, 'change', () => selectNeighborhood(neighborhoodSelect.value || null));
  listen(markerSelect, 'change', () => selectMarker(markerSelect.value || null));
  listen(svg, 'keydown', (event) => {
    const target = event.target instanceof SVGElement ? event.target : null;
    const districtId = Number(target?.dataset.district);
    if (
      target?.closest('[data-layer="district-fills"], [data-layer="district-lines"]') &&
      districtRow(districtId)
    ) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (activateDistrict(districtId)) target.focus();
      } else if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        const rows = data.map.districts?.[year] ?? [];
        const index = rows.findIndex((row) => row.id === districtId);
        const next = rows[(index + (event.key === ']' ? 1 : rows.length - 1)) % rows.length];
        const activeLayer = enabled('districtFills') ? 'district-fills' : 'district-lines';
        const nextNode = svg.querySelector<SVGPathElement>(
          `[data-layer="${activeLayer}"] [data-district="${next.id}"]`,
        );
        target.setAttribute('tabindex', '-1');
        nextNode?.setAttribute('tabindex', '0');
        nextNode?.focus();
      }
      return;
    }
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
  listen(markerLayer, 'focusout', scheduleLabels);
  listen(markerLayer, 'focusin', scheduleLabels);
  function activateMarker(id: string, node: SVGElement) {
    const item = markerItems.find((item) => item.marker.id === id);
    if (!item) return;
    const coincident = markerItems.filter(
      (other) => other.point[0] === item.point[0] && other.point[1] === item.point[1],
    );
    if (coincident.length > 1)
      markerChooser.open(
        coincident.map((other) => other.marker),
        node,
      );
    else {
      selectMarker(id);
      if (!destroyed && selectedMarker === id)
        markerItems.find((other) => other.marker.id === id)?.node.focus({ preventScroll: true });
    }
  }
  listen(markerLayer, 'click', (event) => {
    const node =
      event.target instanceof Element ? event.target.closest<SVGElement>('[data-marker-id]') : null;
    if (node?.dataset.markerId) activateMarker(node.dataset.markerId, node);
  });
  listen(markerLayer, 'keydown', (event) => {
    const node =
      event.target instanceof Element ? event.target.closest<SVGElement>('[data-marker-id]') : null;
    if (node?.dataset.markerId && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      activateMarker(node.dataset.markerId, node);
    }
  });
  listen(svg, 'click', (event) => {
    const district =
      event.target instanceof Element
        ? event.target.closest<SVGPathElement>(
            '[data-layer="district-fills"] [data-district], [data-layer="district-lines"] [data-district]',
          )
        : null;
    if (district?.dataset.district) {
      activateDistrict(Number(district.dataset.district));
      return;
    }
    const node =
      event.target instanceof Element
        ? event.target.closest<SVGElement>('[data-neighborhood-id]')
        : null;
    if (selectableNeighborhoods && node?.dataset.neighborhoodId)
      selectNeighborhood(node.dataset.neighborhoodId);
  });
  listen(svg, 'pointerover', (event) => {
    const district =
      event.target instanceof Element
        ? event.target.closest<SVGPathElement>(
            '[data-layer="district-fills"] [data-district], [data-layer="district-lines"] [data-district]',
          )
        : null;
    const id = district?.dataset.district ? Number(district.dataset.district) : null;
    if (id === hoveredDistrict) return;
    hoveredDistrict = id;
    updateDistrictAppearance();
    root.dispatchEvent(
      new CustomEvent('districthover', { bubbles: true, detail: districtSelection(id) }),
    );
  });
  listen(svg, 'pointerout', (event) => {
    if (
      event.relatedTarget instanceof Element &&
      event.relatedTarget.closest(
        '[data-layer="district-fills"] [data-district], [data-layer="district-lines"] [data-district]',
      )
    )
      return;
    if (hoveredDistrict === null) return;
    hoveredDistrict = null;
    updateDistrictAppearance();
    root.dispatchEvent(
      new CustomEvent('districthover', { bubbles: true, detail: districtSelection(null) }),
    );
  });
  listen(svg, 'pointerdown', stopAnimation);
  let observer: ResizeObserver | undefined;
  const onResize = () => {
    navigation.cancel();
    scheduleLabels();
    root.dispatchEvent(new CustomEvent('mapresize', { bubbles: true }));
  };

  let presentationRevision = 0;
  function applyPresentation(
    patch: MapConfiguration,
    onCommit?: () => void,
    isCurrent: () => boolean = () => true,
  ) {
    const revision = ++presentationRevision;
    const nextYear = patch.year ?? year;
    const nextMode = patch.mode ?? mode;
    if (
      (patch.year !== undefined || nextMode === 'districts') &&
      (!data.map.districts?.[nextYear] || !data.districts?.[nextYear])
    )
      throw new RangeError(`No ${nextYear} district dataset was supplied.`);
    if (nextMode === 'neighborhoods' && !sources.length)
      throw new RangeError('No neighborhood dataset was supplied.');
    if (patch.source !== undefined && !Object.hasOwn(collections, patch.source))
      throw new RangeError(`Unknown neighborhood source: ${patch.source}`);
    const commitSource =
      patch.source !== undefined && patch.source !== source
        ? prepareSource(patch.source, false)
        : undefined;
    const appearance: MapAppearance | undefined = patch.appearance;
    const nextStyle = appearance ? appearance.districtStyle : districtStyle;
    const districtVersion = districtRevision;
    const prepared =
      appearance || nextYear !== year
        ? prepareDistrictStyles(data.map.districts?.[nextYear] ?? [], nextStyle)
        : districtStyles;
    if (
      destroyed ||
      !isCurrent() ||
      revision !== presentationRevision ||
      districtVersion !== districtRevision
    )
      return false;
    if (nextYear !== year) {
      // Validate target paths and label coordinates before any presentation group commits.
      getLayerPathsWithData({ year: nextYear }, data.map, false);
      for (const feature of data.districts?.[nextYear]?.features ?? [])
        for (const point of feature.properties.labelPoints) map.project(point);
    }
    onCommit?.();
    if (appearance) {
      districtRevision++;
      const next = copyAppearance(appearance);
      theme = next.theme ?? 'transit';
      colors = next.colors ?? {};
      labelStyle = next.labelStyle ?? {};
      areaStyle = next.areaStyle ?? {};
      styleOptions = next.style ?? {};
      minLabelSize = next.labelSize?.min ?? 11;
      maxLabelSize = next.labelSize?.max ?? 12;
      markerRadius = next.markerRadius ?? 6;
      markerHitSize = next.markerHitSize ?? 44;
      markerColor = next.markerColor ?? colors.marker ?? '#245b61';
      selectedMarkerColor = next.selectedMarkerColor ?? colors.selected ?? '#f04f32';
      districtTransition.cancel();
      const fills = districtLayers.find((layer) => layer.dataset.layer === 'district-fills');
      const fade = layerFades.duration();
      const stylesChanged =
        nextStyle !== districtStyle ||
        [...prepared].some(([id, value]) =>
          (['fill', 'stroke', 'opacity'] as const).some(
            (key) => value[key] !== districtStyles.get(id)?.[key],
          ),
        );
      if (fills && fade && enabled('districtFills') && nextYear === year && stylesChanged)
        districtTransition.fade(fills, fade);
      districtStyle = nextStyle;
      districtStyles = prepared;
      const palette = resolveMapColors(theme, colors);
      svg.querySelector('rect')?.setAttribute('fill', palette.water);
      svg.querySelector('[data-layer="coast"]')?.setAttribute('fill', palette.land);
      svg.querySelector('[data-layer="coastline"]')?.setAttribute('stroke', palette.district);
      for (const [layer, color] of [
        ['landmarks', palette.park],
        ['highways', palette.highway],
        ['key-roads', palette.road],
      ] as const)
        for (const node of svg.querySelectorAll(`[data-layer="${layer}"] path`)) {
          node.setAttribute(layer === 'landmarks' ? 'fill' : 'stroke', color);
          if (layer === 'highways')
            node.setAttribute('stroke-width', theme === 'transit' ? '2' : '1.4');
        }
      for (const [token, fallback, name] of [
        ['ink', '#18364f', 'ink'],
        ['surface', '#fff', 'surface'],
        ['accent', '#163d61', 'accent'],
        ['border', '#cedae3', 'border'],
        ['focus', '#1676b8', 'focus'],
        ['controlGap', '6px', 'control-gap'],
        ['font', 'system-ui,sans-serif', 'font'],
      ] as const)
        root.style.setProperty(`--sf-map-${name}`, styleOptions[token] ?? fallback);
      labelLayer.setAttribute(
        'font-family',
        labelStyle.fontFamily ?? styleOptions.font ?? 'system-ui,sans-serif',
      );
      labelRenderer.invalidateMetrics();
      for (const station of stationItems)
        station.node.setAttribute('stroke', colors.bart ?? '#0073ae');
      for (const kind of ['bart', 'park', 'highway', 'road'] as const) {
        const symbol = legend.querySelector<HTMLElement>(`.sf-explorer-legend-${kind}`);
        if (symbol) {
          symbol.style.removeProperty(kind === 'bart' ? 'border-color' : 'background-color');
          if (colors[kind])
            symbol.style.setProperty(
              kind === 'bart' ? 'border-color' : 'background-color',
              colors[kind],
            );
        }
      }
      for (const item of items) {
        const active = item.feature === selected;
        item.node.setAttribute(
          'fill',
          active ? (areaStyle.selectedFill ?? '#408dbe') : 'transparent',
        );
        item.node.setAttribute(
          'stroke',
          active ? (areaStyle.selectedStroke ?? '#176ba2') : (colors.neighborhood ?? '#9caebc'),
        );
      }
      for (const item of markerItems) {
        item.dot.setAttribute(
          'fill',
          item.marker.id === selectedMarker
            ? selectedMarkerColor
            : (item.marker.color ?? markerColor),
        );
        item.ring.setAttribute(
          'stroke',
          features.selectedMarkerRing
            ? (features.selectedMarkerRing.color ?? selectedMarkerColor)
            : selectedMarkerColor,
        );
      }
      invalidateClusters();
      updateDistrictAppearance();
    }
    if (nextYear !== year) setDistrictYear(nextYear, {}, prepared);
    if (destroyed || revision !== presentationRevision || !isCurrent()) return false;
    commitSource?.();
    if (destroyed || revision !== presentationRevision || !isCurrent()) return false;
    if (commitSource && appearance)
      for (const item of items) item.node.setAttribute('stroke', colors.neighborhood ?? '#9caebc');
    if (patch.mode !== undefined) setMode(patch.mode, false);
    if (patch.labels !== undefined) setLabels(patch.labels);
    scheduleLabels();
    return true;
  }
  const explorer = Object.assign(root, {
    applyPresentation,
    getMapState: () => ({ mode, source, year, labels }),
    selectNeighborhood,
    getSelection,
    selectDistrict,
    getSelectedDistrict,
    setDistrictYear,
    setDistrictStyle,
    getViewport,
    setViewport: moveView,
    stopAnimation,
    setFeatures,
    getFeatures,
    setLayers,
    setControls,
    overlayElement,
    projectToScreen,
    fitGeometry,
    panBy,
    setTouchNavigation,
    setMarkers,
    setOverlays,
    selectMarker,
    getSelectedMarker,
    setSource,
    setMode,
    setLabels,
    resetView,
    zoomBy,
    destroy() {
      destroyed = true;
      markerChooser.close();
      camera.destroy();
      districtTransition.cancel();
      layerFades.cancel();
      districtMorph.stop();
      cancelEntrances();
      controller.abort();
      overlayEvents.abort();
      clusterEvents.abort();
      canvas.style.touchAction = 'pan-y pinch-zoom';
      observer?.disconnect();
      frames.destroy();
      labelRenderer.clear();
      releaseDownloads();
    },
  });
  try {
    observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    document.fonts?.addEventListener(
      'loadingdone',
      () => {
        labelRenderer.invalidateMetrics();
        scheduleLabels();
      },
      { signal: controller.signal },
    );
    reducedMotion.addEventListener(
      'change',
      () => {
        if (reducedMotion.matches) {
          stopAnimation();
          districtTransition.cancel();
          layerFades.cancel();
          districtMorph.stop();
          cancelEntrances();
        }
      },
      { signal: controller.signal },
    );
    const initialMode = mode;
    if (sources.length) setSource(source);
    if (neighborhood !== undefined) selectNeighborhood(neighborhood);
    setMode(initialMode);
    if (initialMode === 'neighborhoods' && selected) {
      const selectedItem = items.find((item) => item.feature === selected);
      if (selectedItem) setView(fitBounds(selectedItem.bounds));
    }
    setLabels(labels);
    setTouchNavigation(false);
    setLayers(layers);
    setControls(controls);
    setMarkers(initialMarkers);
    setOverlays(initialOverlays);
    initialized = true;
  } catch (error) {
    explorer.destroy();
    throw error;
  }
  return explorer;
}
