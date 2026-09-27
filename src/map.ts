import { validateCameraOptions } from './camera.js';
import { expandMapOptions, prepareConfiguration } from './configuration.js';
import type { MapController, MapEvents, MapOptions } from './controller-types.js';
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
  return Object.freeze({
    element,
    overlayElement: element.overlayElement,
    camera,
    get destroyed() {
      return destroyed;
    },
    configure: use((patch) => {
      const next = prepareConfiguration(config, patch);
      // Full switch patches are needed so removed overrides reset engine defaults.
      const layers = Object.fromEntries(layerKeys.map((key) => [key, next.layers[key]]));
      const controls = Object.fromEntries(controlKeys.map((key) => [key, next.controls[key]]));
      if ('features' in patch) element.setFeatures(patch.features ?? next.features);
      if ('layers' in patch) element.setLayers(layers);
      if ('controls' in patch) element.setControls(controls);
      config = next;
    }),
    getConfiguration: use(() => structuredClone(config)),
    on: use(<K extends keyof MapEvents>(type: K, listener: (detail: MapEvents[K]) => void) => {
      if (
        ![
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
    setDistrictYear: use(element.setDistrictYear),
    setDistrictStyle: use(element.setDistrictStyle),
    setSource: use(element.setSource),
    setMode: use(element.setMode),
    setLabels: use(element.setLabels),
    setTouchNavigation: use(element.setTouchNavigation),
    projectToScreen: use(element.projectToScreen),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const unsubscribe of subscriptions) unsubscribe();
      element.destroy();
    },
  } satisfies MapController);
}
