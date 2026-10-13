import type { Bounds, NeighborhoodSource } from '../data/types.js';
import { copyAppearance } from './appearance.js';
import { createCamera, validateCameraOptions } from './camera.js';
import { createClusterLayer } from './cluster-layer.js';
import { clusterPoints } from './clusters.js';
import type { MapAppearance, MapConfiguration } from './controller-types.js';
import { renderDistrictAppearance } from './district-layer.js';
import { createDistrictMorph } from './district-morph.js';
import { prepareDistrictStyles } from './district-style.js';
import { createDistrictTransition } from './district-transition.js';
import { element, setAttributeIfChanged, svgElement } from './dom.js';
import { createExplorerControls } from './explorer-controls.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { View } from './explorer-layout.js';
import { fitBounds, projectedBounds } from './explorer-layout.js';
import type { createMapShell } from './explorer-shell.js';
import type { createExplorerSidebar } from './explorer-sidebar.js';
import { controlKeys, layerKeys, normalizeFeatures, validateSwitchPatch } from './features.js';
import { createFrameScheduler } from './frame-scheduler.js';
import {
  type LabelItem,
  labelCandidates,
  type RenderLabel,
  styleLabels,
} from './label-candidates.js';
import { createLabelRenderer } from './label-renderer.js';
import { createLayerTransitions } from './layer-transition.js';
import {
  createSFMapWithData,
  districtColors,
  getLayerPathsWithData,
  resolveMapColors,
} from './map-core.js';
import { createMarkerCatalog } from './marker-catalog.js';
import { createMarkerChooser } from './marker-chooser.js';
import { createMarkerLayer, type MarkerItem, type MarkerVisual } from './marker-layer.js';
import { createMarkerNavigation } from './marker-navigation.js';
import {
  createNeighborhoodLayer,
  createNeighborhoodLookup,
  formatSourceLabel,
} from './neighborhood-layer.js';
import { createOverlayLayer } from './overlay-layer.js';
import type {
  CameraOptions,
  DistrictSelection,
  DistrictYear,
  ExplorerMode,
  InteractiveLayers,
  MapFeatures,
  MapMarker,
  MapViewport,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
} from './types.js';
import { validateExplorerOptions } from './validation.js';
import { fitViewport, validateViewport } from './viewport.js';

export type {
  ExplorerMode,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
} from './types.js';

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

/** Create an offline, browser-only neighborhood explorer. Call destroy() before disposal. */
export function createNeighborhoodExplorerCore(
  options: NeighborhoodExplorerOptions = {},
  data: InteractiveSFMapData,
  ui: {
    createShell: typeof createMapShell;
    createSidebar?: typeof createExplorerSidebar;
  },
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
  const { getNeighborhood, searchNeighborhoods } = createNeighborhoodLookup(collections);
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
  const shell = ui.createShell({
    source,
    sources,
    hasDistricts: !!data.districts?.[year],
    chrome,
    styleOptions,
    strings,
    legendOptions,
    colors,
    attributionMode,
  });
  const {
    root,
    modeSelect,
    sourceLabel,
    sourceSelect,
    searchLabel,
    count,
    results,
    canvas,
    status,
    legend,
    featureControls,
    neighborhoodLabel,
    neighborhoodSelect,
    markerLabel,
    markerSelect,
    attribution,
  } = shell;
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
  const markerRenderer = createMarkerLayer();
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
  const neighborhoods = createNeighborhoodLayer({
    collections,
    initialSource: source,
    project: map.project,
    root,
    areas,
    canvas,
    sourceSelect,
    neighborhoodSelect,
    status,
    readPresentation: () => ({
      mode,
      year,
      fitPadding,
      areaStyle,
      colors,
      selectableNeighborhoods,
      lines: enabled('neighborhoodLines'),
    }),
    isDestroyed: () => destroyed,
    ensureVisible() {
      if (
        !enabled('neighborhoodLines') &&
        !enabled('neighborhoodLabels') &&
        (layers.neighborhoodLines === undefined || layers.neighborhoodLabels === undefined)
      )
        setMode('neighborhoods', false);
    },
    refresh: {
      selection() {
        scheduleLabels();
        updateResults();
        updateDetail();
      },
      source() {
        updateResults();
        updateDetail();
        updateComposition();
      },
    },
    moveView,
    resetView,
    crossfade: layerFades.crossfade,
  });
  const { getSelection, selectNeighborhood, prepareSource, setSource } = neighborhoods;

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
    for (const { visual, marker } of markerCatalog.items) {
      if (!visual) continue;
      const ring = features.selectedMarkerRing;
      visual.ring.setAttribute('display', ring && marker.id === selectedMarker ? 'inline' : 'none');
      visual.ring.setAttribute(
        'stroke',
        ring ? (ring.color ?? selectedMarkerColor) : selectedMarkerColor,
      );
      visual.ring.setAttribute('stroke-width', String(ring ? ring.width : 2));
    }
    scheduleLabels();
  }
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
  const secondaryRoads = svg.querySelectorAll<SVGPathElement>('[data-key-road-level="secondary"]');
  let secondaryRoadsVisible: boolean | undefined;
  const scaleUnitsPerMeter =
    Math.abs(map.project([-122.44, 37.76])[0] - map.project([-122.45, 37.76])[0]) / 879;
  const parkItems = (data.map.landmarks ?? []).map((feature) => ({
    point: map.project(feature.label),
    name: feature.name,
    kind: 'park',
  }));
  const markerCatalog = createMarkerCatalog(markerRenderer, markerSelect, map.project);
  let selectedMarker: string | null = null;
  const markerNavigation = createMarkerNavigation(svg, controller.signal);
  const markerChooser = createMarkerChooser(canvas, svg, (id) => {
    if (destroyed) return;
    selectMarker(id);
    if (!destroyed && selectedMarker === id)
      markerCatalog.items
        .find((item) => item.marker.id === id)
        ?.visual?.node.focus({ preventScroll: true });
  });
  let markerRevision = 0;
  const clusterLayer = svgElement('g', { 'data-layer': 'marker-clusters' });
  geography.insertBefore(clusterLayer, markerLayer);
  function materializeMarker(item: MarkerItem) {
    return Object.assign(item, {
      visual: markerRenderer.materialize(item, {
        features,
        markerColor,
        selectedMarkerColor,
        reducedMotion: reducedMotion.matches,
        selected: item.marker.id === selectedMarker,
      }),
    });
  }
  const clusters = createClusterLayer(
    svg,
    markerLayer,
    clusterLayer,
    markerNavigation,
    materializeMarker,
    (group, node, signal) => {
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
      if (!destroyed && !signal.aborted)
        root.dispatchEvent(
          new CustomEvent('clusteractivate', { bubbles: true, detail: { markers } }),
        );
    },
  );
  let renderedMarkers: (MarkerItem & { visual: MarkerVisual })[] = [];
  let renderedClusters: { point: [number, number] }[] = [];
  function invalidateClusters() {
    markerChooser.close();
    clusters.invalidate();
  }
  function drawClusters(unit: number) {
    const rendered = clusters.draw({
      unit,
      view,
      items: markerCatalog.items,
      revision: markerRevision,
      selected: selectedMarker,
      features,
      markerColor,
      markerRadius,
      markerHitSize,
    });
    renderedMarkers = rendered.markers;
    renderedClusters = rendered.clusters;
  }
  const overlays = createOverlayLayer({
    layer: overlayLayer,
    root,
    project: map.project,
    onOverlayActivate,
    isDestroyed: () => destroyed,
  });
  const setOverlays = overlays.set;
  const mapControls = createExplorerControls(shell, {
    svg,
    signal: controller.signal,
    strings,
    isDestroyed: () => destroyed,
    getLabels: () => labels,
    getViewport,
    moveView,
    zoomBy,
    resetView,
    setLabels,
    stopAnimation,
    setView,
    setMode,
    setSource,
    selectNeighborhood,
    selectMarker,
    updateResults,
    search(query) {
      const exact = getNeighborhood(query, neighborhoods.source);
      const matches = searchNeighborhoods(query, neighborhoods.source);
      return exact?.id ?? (matches.length === 1 ? matches[0].id : undefined);
    },
  });
  const setTouchNavigation = mapControls.setTouchNavigation;
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
    mapControls.updateZoom(zoom);
    root.dataset.zoom = String(zoom);
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
  let labelInputs: readonly unknown[] = [];
  let preparedLabels: RenderLabel[] = [];
  function prepareLabels(width: number, zoom: number) {
    // Only screen-space positioning changes during pan or within these zoom/width bands.
    const inputs = [
      neighborhoods.items,
      neighborhoods.selected,
      districtItems,
      markerRevision,
      layers,
      mode,
      labelStyle,
      colors,
      minLabelSize,
      maxLabelSize,
      markerRadius,
      zoom >= 1.8,
      width >= 550,
    ];
    if (inputs.every((value, index) => value === labelInputs[index])) return preparedLabels;
    labelInputs = inputs;
    const selectedItem = neighborhoods.items.find(
      (item) => item.feature === neighborhoods.selected,
    );
    const candidates: LabelItem[] = [];
    const marker = markerCatalog.items.find((item) => item.marker.id === selectedMarker);
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
    preparedLabels = styleLabels(
      labelCandidates(
        {
          selected: candidates,
          districts: enabled('districtLabels') ? districtItems : [],
          stations: enabled('bartStations') ? stationItems : [],
          parks: enabled('landmarks') ? parkItems : [],
          roads: enabled('roadLabels') ? roadItems : [],
          neighborhoods: enabled('neighborhoodLabels')
            ? neighborhoods.items
                .filter((item) => item.point !== undefined)
                .sort((a, b) => b.area - a.area || a.feature.id.localeCompare(b.feature.id))
                .flatMap((item) =>
                  item.feature !== neighborhoods.selected && item.point
                    ? [
                        {
                          point: item.point,
                          name: item.feature.properties.canonicalName,
                          kind: 'neighborhood',
                        },
                      ]
                    : [],
                )
            : [],
        },
        width,
        zoom,
      ),
      {
        colors,
        labelStyle,
        labelSize: { min: minLabelSize, max: maxLabelSize },
        markerRadius: marker?.marker.radius ?? markerRadius,
      },
    );
    return preparedLabels;
  }
  function drawLabels() {
    if (destroyed) return;
    const canvasBox = canvas.getBoundingClientRect();
    const width = canvasBox.width;
    if (!width) return;
    const unit = view[2] / width,
      zoom = 800 / view[2];
    if (features.scaleBar) {
      const pixelsPerMeter = scaleUnitsPerMeter / unit;
      const base = 10 ** Math.floor(Math.log10(100 / pixelsPerMeter));
      const meters =
        [5, 2, 1].map((factor) => factor * base).find((value) => value * pixelsPerMeter <= 100) ??
        base;
      const scaleWidth = `${meters * pixelsPerMeter}px`;
      const scaleText = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
      if (scale.style.width !== scaleWidth) scale.style.width = scaleWidth;
      if (scale.textContent !== scaleText) scale.textContent = scaleText;
    }
    // Read overlay bounds before SVG writes; scale furniture above must have its current width.
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
    const showSecondaryRoads = zoom >= 1.8;
    if (showSecondaryRoads !== secondaryRoadsVisible) {
      for (const road of secondaryRoads) road.style.display = showSecondaryRoads ? '' : 'none';
      secondaryRoadsVisible = showSecondaryRoads;
    }
    for (const station of stationItems) setAttributeIfChanged(station.node, 'r', 4.5 * unit);
    drawClusters(unit);
    if (!labels) {
      labelRenderer.clear();
      root.dataset.visibleLabels = '0';
      return;
    }
    const labelCandidates = prepareLabels(width, zoom);
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
  const sidebar = ui.createSidebar?.(
    shell,
    data,
    chrome,
    strings.emptyResults,
    searchNeighborhoods,
  );
  function updateDetail() {
    sidebar?.updateDetail({
      mode,
      year,
      source: neighborhoods.source,
      selected: neighborhoods.selected,
    });
  }
  function updateResults() {
    sidebar?.updateResults({
      mode,
      year,
      source: neighborhoods.source,
      selected: neighborhoods.selected,
    });
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
    for (const item of neighborhoods.items) {
      item.node.setAttribute(
        'stroke-width',
        item.feature === neighborhoods.selected
          ? '2.2'
          : enabled('neighborhoodLines')
            ? '.55'
            : '0',
      );
      item.node.setAttribute(
        'tabindex',
        selectableNeighborhoods && item === neighborhoods.items[0] ? '0' : '-1',
      );
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
      const collection = collections[neighborhoods.source];
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
    const marker = markerCatalog.items.find((item) => item.marker.id === selectedMarker)?.marker;
    return marker ? { ...marker } : null;
  }
  function selectMarker(id: string | null, options: { fit?: boolean } & CameraOptions = {}) {
    if (destroyed) return false;
    const item = markerCatalog.items.find((item) => item.marker.id === id);
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
    for (const entry of markerCatalog.items) {
      const active = entry.marker.id === id;
      const visual = active ? materializeMarker(entry).visual : entry.visual;
      if (!visual) continue;
      const pressed = String(active);
      const ring = active && features.selectedMarkerRing ? 'inline' : 'none';
      const fill = active ? selectedMarkerColor : (entry.marker.color ?? markerColor);
      if (visual.node.getAttribute('aria-pressed') !== pressed)
        visual.node.setAttribute('aria-pressed', pressed);
      if (visual.ring.getAttribute('display') !== ring) visual.ring.setAttribute('display', ring);
      if (visual.dot.getAttribute('fill') !== fill) visual.dot.setAttribute('fill', fill);
      if (active && markerLayer.lastChild !== visual.node) markerLayer.append(visual.node);
    }
    scheduleLabels();
    if (width || !features.clustering) drawClusters(width ? view[2] / width : 1);
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
    const prepared = markerCatalog.prepare(markers, selectedMarker);
    if (!prepared) return;
    const { selection: nextSelection, focused: focusedMarker } = prepared;
    invalidateClusters();
    prepared.commit();
    markerLabel.hidden = !markerCatalog.items.length || controls.markerPicker === false;
    if (markerLabel.firstChild)
      markerLabel.firstChild.textContent = `${strings.chooseMarker ?? 'Choose marker'} (${markerCatalog.items.length})`;
    syncFeatureControls();
    const revision = markerRevision + 1;
    selectMarker(nextSelection, { fit: false });
    if (!destroyed && markerRevision === revision && focusedMarker) {
      markerNavigation.sync(
        markerCatalog.items.flatMap((item) => (item.visual ? [item.visual.node] : [])),
      );
      if (!markerNavigation.recover()) {
        const recovery =
          markerCatalog.items.find((item) => item.marker.id === focusedMarker) ??
          markerCatalog.items[0];
        if (recovery) {
          const { node } = materializeMarker(recovery).visual;
          markerLayer.append(node);
          node.focus({ preventScroll: true });
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
    mapControls.update(controls);
    markerLabel.hidden = !markerCatalog.items.length || controls.markerPicker === false;
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
          : neighborhoods.selected
            ? `${neighborhoods.selected.properties.canonicalName} selected. ${formatSourceLabel(neighborhoods.source)}.`
            : `${formatSourceLabel(neighborhoods.source)}. Select a neighborhood to begin.`;
    if (reset) resetView();
  }
  function setLabels(visible: boolean) {
    if (destroyed) return;
    if (typeof visible !== 'boolean') throw new TypeError('Labels must be a boolean.');
    labels = visible;
    mapControls.updateLabels(labels);
    root.dataset.labels = String(labels);
    updateComposition();
    if (!labels) {
      labelLayer.replaceChildren();
      root.dataset.visibleLabels = '0';
    }
    scheduleLabels();
  }
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
      const i = neighborhoods.items.findIndex((item) => item.feature.id === id);
      const next =
        neighborhoods.items[
          (i + (event.key === ']' ? 1 : neighborhoods.items.length - 1)) %
            neighborhoods.items.length
        ];
      for (const item of neighborhoods.items)
        item.node.setAttribute('tabindex', item === next ? '0' : '-1');
      next.node.focus();
    }
  });
  listen(markerLayer, 'focusout', scheduleLabels);
  listen(markerLayer, 'focusin', scheduleLabels);
  function activateMarker(id: string, node: SVGElement) {
    const item = markerCatalog.items.find((item) => item.marker.id === id);
    if (!item) return;
    const coincident = markerCatalog.items.filter(
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
        markerCatalog.items
          .find((other) => other.marker.id === id)
          ?.visual?.node.focus({ preventScroll: true });
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
    mapControls.cancelNavigation();
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
      patch.source !== undefined && patch.source !== neighborhoods.source
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
      for (const item of neighborhoods.items) {
        const active = item.feature === neighborhoods.selected;
        item.node.setAttribute(
          'fill',
          active ? (areaStyle.selectedFill ?? '#408dbe') : 'transparent',
        );
        item.node.setAttribute(
          'stroke',
          active ? (areaStyle.selectedStroke ?? '#176ba2') : (colors.neighborhood ?? '#9caebc'),
        );
      }
      for (const item of markerCatalog.items) {
        const visual = item.visual;
        if (!visual) continue;
        visual.dot.setAttribute(
          'fill',
          item.marker.id === selectedMarker
            ? selectedMarkerColor
            : (item.marker.color ?? markerColor),
        );
        visual.ring.setAttribute(
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
      for (const item of neighborhoods.items)
        item.node.setAttribute('stroke', colors.neighborhood ?? '#9caebc');
    if (patch.mode !== undefined) setMode(patch.mode, false);
    if (patch.labels !== undefined) setLabels(patch.labels);
    scheduleLabels();
    return true;
  }
  const explorer = Object.assign(root, {
    applyPresentation,
    getMapState: () => ({ mode, source: neighborhoods.source, year, labels }),
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
      overlays.destroy();
      clusters.destroy();
      canvas.style.touchAction = 'pan-y pinch-zoom';
      observer?.disconnect();
      frames.destroy();
      labelRenderer.clear();
      sidebar?.destroy();
      neighborhoods.destroy();
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
    if (sources.length) setSource(neighborhoods.source);
    if (neighborhood !== undefined) selectNeighborhood(neighborhood);
    setMode(initialMode);
    if (initialMode === 'neighborhoods' && neighborhoods.selected) {
      const selectedItem = neighborhoods.items.find(
        (item) => item.feature === neighborhoods.selected,
      );
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
