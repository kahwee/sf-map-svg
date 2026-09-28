import type { Geometry, NeighborhoodSource } from '../data/types.js';
import type {
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
  NeighborhoodExplorerOptions,
  NeighborhoodSelection,
} from './types.js';

export type MapAppearance = Pick<
  NeighborhoodExplorerOptions,
  | 'theme'
  | 'colors'
  | 'labelStyle'
  | 'areaStyle'
  | 'districtStyle'
  | 'labelSize'
  | 'style'
  | 'markerRadius'
  | 'markerHitSize'
  | 'markerColor'
  | 'selectedMarkerColor'
>;
export type MapControls = NonNullable<NeighborhoodExplorerOptions['controls']>;
/** Omitted groups/keys retain their values; undefined groups reset all keys in that group. */
export interface MapConfiguration {
  features?: MapFeatures;
  layers?: InteractiveLayers;
  controls?: MapControls;
}
export interface MapOptions
  extends Omit<
    NeighborhoodExplorerOptions,
    keyof MapFeatures | keyof MapAppearance | 'interface' | 'onMarkerActivate' | 'onOverlayActivate'
  > {
  features?: MapFeatures;
  appearance?: MapAppearance;
}
export interface MapConfigurationSnapshot {
  features: MapFeatures;
  /** Explicit overrides; absent values continue to follow the current mode. */
  layers: InteractiveLayers;
  controls: MapControls;
}
export interface MapEvents {
  districtchange: DistrictSelection | { id: null; year: DistrictYear; district: null };
  districthover: DistrictSelection | { id: null; year: DistrictYear; district: null };
  districtactivate: DistrictSelection;
  districtyearchange: { year: DistrictYear; previousYear: DistrictYear };
  markerchange: { id: string | null; marker: MapMarker | null };
  neighborhoodchange:
    | NeighborhoodSelection
    | { id: null; name: null; source: NeighborhoodSource; feature: null };
  overlayactivate: { overlay: MapOverlay };
  clusteractivate: { markers: MapMarker[] };
  viewportchange: { viewport: MapViewport };
  mapresize: undefined;
}
export interface MapCamera {
  get(): MapViewport;
  set(view: MapViewport, options?: CameraOptions): void;
  fit(geometry: Geometry, options?: CameraOptions & { padding?: number | MapPadding }): void;
  pan(x: number, y: number, options?: CameraOptions): void;
  zoom(factor: number, options?: CameraOptions): void;
  reset(options?: CameraOptions): void;
  stop(): void;
}
/** Owns the map lifecycle separately from its mountable DOM element. */
export interface MapController {
  readonly element: HTMLElement;
  readonly overlayElement: HTMLDivElement;
  readonly camera: MapCamera;
  readonly destroyed: boolean;
  configure(patch: MapConfiguration): void;
  getConfiguration(): MapConfigurationSnapshot;
  on<K extends keyof MapEvents>(type: K, listener: (detail: MapEvents[K]) => void): () => void;
  /** Reconcile stable IDs; retained markers preserve nodes, focus, and entrance animations. */
  setMarkers(markers: readonly MapMarker[]): void;
  setOverlays(overlays: readonly MapOverlay[]): void;
  selectMarker(id: string | null, options?: CameraOptions & { fit?: boolean }): boolean;
  getSelectedMarker(): MapMarker | null;
  selectNeighborhood(name: string | null, options?: CameraOptions & { fit?: boolean }): boolean;
  getSelectedNeighborhood(): NeighborhoodSelection | null;
  selectDistrict(id: number | null, options?: CameraOptions & { fit?: boolean }): boolean;
  getSelectedDistrict(): DistrictSelection | null;
  setDistrictYear(year: DistrictYear, options?: CameraOptions): void;
  setDistrictStyle(
    style: ((district: DistrictSelection['district']) => DistrictStyle) | undefined,
  ): void;
  setSource(source: NeighborhoodSource): void;
  setMode(mode: NonNullable<MapOptions['mode']>): void;
  setLabels(visible: boolean): void;
  setTouchNavigation(enabled: boolean): void;
  projectToScreen(lng: number, lat: number): { x: number; y: number; visible: boolean };
  /** Idempotent; stops work and managed subscriptions. Does not remove host-owned DOM. */
  destroy(): void;
}
