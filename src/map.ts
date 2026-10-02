import { copyAppearance } from './appearance.js';
import { validateCameraOptions } from './camera.js';
import { expandMapOptions, prepareConfiguration } from './configuration.js';
import type {
  MapCapabilities,
  MapController,
  MapEvents,
  MapOptions,
  MapSelectionChange,
  ResolvedMapConfiguration,
} from './controller-types.js';
import { createNeighborhoodExplorerCore } from './explorer-core.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { controlKeys, layerKeys } from './features.js';
import { assertOptions } from './validation.js';

export type * from './controller-types.js';
export type { InteractiveSFMapData as MapData } from './explorer-data.js';
export type {
  CameraOptions,
  DistrictSelection,
  DistrictStyle,
  DistrictYear,
  InteractiveLayers,
  MapFeatures,
  MapMarker,
  MapOverlay,
  MapPadding,
  MapViewport,
  NeighborhoodSelection,
} from './types.js';

/** No geography is imported. Supply a preset or your own immutable data. */
export function createMap(data: InteractiveSFMapData, options: MapOptions = {}): MapController {
  const expanded = expandMapOptions(options);
  let config = prepareConfiguration(
    { features: {}, layers: {}, controls: {} },
    {
      features: options.features,
      layers: options.layers,
      controls: options.controls,
      appearance: options.appearance,
    },
  );
  const element = createNeighborhoodExplorerCore(
    {
      mode: 'basemap',
      ...expanded,
      interface: 'map',
      onOverlayActivate: () => {},
    },
    data,
  );
  const subscriptions = new Set<() => void>();
  let configurationRevision = 0;
  const sourceList = (['realtor', 'sf-find', 'analysis'] as const).filter(
    (source) => !!data.neighborhoods[source],
  );
  const yearList = ([2002, 2012, 2022] as const).filter(
    (year) => !!data.map.districts?.[year] && !!data.districts?.[year],
  );
  const capabilities = (): MapCapabilities => ({
    sources: [...sourceList],
    years: [...yearList],
    layers: Object.fromEntries(
      layerKeys.map((key) => [
        key,
        key.startsWith('district')
          ? !!data.map.districts?.[element.getMapState().year]?.length &&
            yearList.includes(element.getMapState().year)
          : key.startsWith('neighborhood')
            ? !!data.neighborhoods[element.getMapState().source]?.features.length
            : key === 'roadLabels'
              ? !!data.map.keyRoads?.length
              : !!data.map[key as 'landmarks' | 'bartStations' | 'highways' | 'keyRoads']?.length,
      ]),
    ) as MapCapabilities['layers'],
  });
  const snapshot = () => ({
    ...structuredClone({
      features: config.features,
      layers: config.layers,
      controls: config.controls,
    }),
    appearance: copyAppearance(config.appearance),
  });
  const resolved = (): ResolvedMapConfiguration => {
    const state = element.getMapState();
    const supplied = capabilities().layers;
    return {
      ...snapshot(),
      ...state,
      layers: Object.fromEntries(
        layerKeys.map((key) => [
          key,
          supplied[key] &&
            (!key.endsWith('Labels') || state.labels) &&
            (config.layers[key] ??
              (key.startsWith('district')
                ? state.mode === 'districts'
                : key.startsWith('neighborhood')
                  ? state.mode === 'neighborhoods'
                  : true)),
        ]),
      ) as ResolvedMapConfiguration['layers'],
    };
  };
  let previousMarker = element.getSelectedMarker();
  let previousNeighborhood = element.getSelection();
  let previousDistrict = element.getSelectedDistrict();
  const selectionListeners: (() => void)[] = [];
  for (const type of ['markerchange', 'neighborhoodchange', 'districtchange'] as const) {
    const handle = (event: Event) => {
      if (event.target !== element) return;
      let detail: MapSelectionChange;
      if (type === 'markerchange') {
        const current = element.getSelectedMarker();
        detail = { kind: 'marker', current, previous: previousMarker };
        previousMarker = current;
      } else if (type === 'neighborhoodchange') {
        const current = element.getSelection();
        detail = { kind: 'neighborhood', current, previous: previousNeighborhood };
        previousNeighborhood = current;
      } else {
        const current = element.getSelectedDistrict();
        detail = { kind: 'district', current, previous: previousDistrict };
        previousDistrict = current;
      }
      element.dispatchEvent(
        new CustomEvent('selectionchange', { detail: structuredClone(detail) }),
      );
    };
    element.addEventListener(type, handle);
    selectionListeners.push(() => element.removeEventListener(type, handle));
  }
  let destroyed = false;
  function active() {
    if (destroyed) throw new Error('Map controller has been destroyed.');
  }
  const use =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      active();
      return fn(...args);
    };
  const camera = Object.freeze({
    get: use(element.getViewport),
    set: use(element.setViewport),
    stop: use(element.stopAnimation),
    pan: use(element.panBy),
    zoom: use(element.zoomBy),
    reset: use(element.resetView),
    fit: use(
      (
        geometry: Parameters<typeof element.fitGeometry>[0],
        fitOptions: Parameters<MapController['camera']['fit']>[1] = {},
      ) => {
        assertOptions(fitOptions, 'fit', ['padding', 'animate', 'duration']);
        const { padding, ...motion } = fitOptions;
        validateCameraOptions(motion);
        element.fitGeometry(geometry, padding, motion);
      },
    ),
  });
  function configure(patch: import('./controller-types.js').MapConfiguration) {
    const revision = ++configurationRevision;
    const next = prepareConfiguration(config, patch);
    const hasFeatures = 'features' in patch,
      hasLayers = 'layers' in patch,
      hasControls = 'controls' in patch;
    const layers = Object.fromEntries(layerKeys.map((key) => [key, next.layers[key]]));
    const controls = Object.fromEntries(controlKeys.map((key) => [key, next.controls[key]]));
    const features =
      patch.features === undefined
        ? next.features
        : Object.fromEntries(
            Object.keys(patch.features).map((key) => [
              key,
              next.features[key as keyof typeof next.features],
            ]),
          );
    element.applyPresentation(
      { ...patch, ...('appearance' in patch ? { appearance: next.appearance } : {}) },
      () => {
        config = next;
        if (hasFeatures) element.setFeatures(features);
        if (hasLayers) element.setLayers(layers);
        if (hasControls) element.setControls(controls);
      },
      () => !destroyed && revision === configurationRevision,
    );
  }
  return Object.freeze({
    element,
    overlayElement: element.overlayElement,
    camera,
    get destroyed() {
      return destroyed;
    },
    configure: use(configure),
    getConfiguration: use(snapshot),
    getResolvedConfiguration: use(resolved),
    getCapabilities: use(capabilities),
    on: use(<K extends keyof MapEvents>(type: K, listener: (detail: MapEvents[K]) => void) => {
      if (
        ![
          'selectionchange',
          'markerchange',
          'districtchange',
          'districthover',
          'districtactivate',
          'districtyearchange',
          'neighborhoodchange',
          'overlayactivate',
          'clusteractivate',
          'viewportchange',
          'mapresize',
        ].includes(type) ||
        typeof listener !== 'function'
      )
        throw new TypeError('Expected a supported map event and listener.');
      const handle = (event: Event) => {
        if (event.target === element)
          listener(structuredClone((event as CustomEvent).detail ?? undefined));
      };
      element.addEventListener(type, handle);
      const unsubscribe = () => {
        element.removeEventListener(type, handle);
        subscriptions.delete(unsubscribe);
      };
      subscriptions.add(unsubscribe);
      return unsubscribe;
    }),
    setMarkers: use(element.setMarkers),
    setOverlays: use(element.setOverlays),
    selectMarker: use(element.selectMarker),
    getSelectedMarker: use(element.getSelectedMarker),
    selectNeighborhood: use(element.selectNeighborhood),
    getSelectedNeighborhood: use(element.getSelection),
    selectDistrict: use(element.selectDistrict),
    getSelectedDistrict: use(element.getSelectedDistrict),
    setDistrictYear: use((...args: Parameters<MapController['setDistrictYear']>) => {
      configurationRevision++;
      element.setDistrictYear(...args);
    }),
    setDistrictStyle: use((style) => {
      configure({ appearance: { districtStyle: style } });
    }),
    setSource: use((...args: Parameters<MapController['setSource']>) => {
      configurationRevision++;
      element.setSource(...args);
    }),
    setMode: use((...args: Parameters<MapController['setMode']>) => {
      configurationRevision++;
      element.setMode(...args);
    }),
    setLabels: use((...args: Parameters<MapController['setLabels']>) => {
      configurationRevision++;
      element.setLabels(...args);
    }),
    setTouchNavigation: use(element.setTouchNavigation),
    projectToScreen: use(element.projectToScreen),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const unsubscribe of subscriptions) unsubscribe();
      for (const unsubscribe of selectionListeners) unsubscribe();
      element.destroy();
    },
  } satisfies MapController);
}
