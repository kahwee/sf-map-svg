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
/** Omitted keys retain values. Undefined presentation groups reset; undefined mode/source/year/labels retain their current value. */
export interface MapConfiguration {
  features?: MapFeatures;
  layers?: InteractiveLayers;
  controls?: MapControls;
  appearance?: MapAppearance;
  mode?: NonNullable<NeighborhoodExplorerOptions['mode']>;
  source?: NeighborhoodSource;
  year?: DistrictYear;
  labels?: boolean;
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
  appearance?: MapAppearance;
}
export interface MapCapabilities {
  sources: readonly NeighborhoodSource[];
  years: readonly DistrictYear[];
  /** Data availability, independent of requested layer visibility. */
  layers: Readonly<Record<keyof InteractiveLayers, boolean>>;
}
export interface ResolvedMapConfiguration extends MapConfigurationSnapshot {
  mode: NonNullable<MapOptions['mode']>;
  source: NeighborhoodSource;
  year: DistrictYear;
  labels: boolean;
  /** Effective switches after mode defaults and data availability; label switches honor labels. */
  layers: Record<keyof InteractiveLayers, boolean>;
}
export type MapSelectionChange =
  | { kind: 'marker'; current: MapMarker | null; previous: MapMarker | null }
  | {
      kind: 'neighborhood';
      current: NeighborhoodSelection | null;
      previous: NeighborhoodSelection | null;
    }
  | { kind: 'district'; current: DistrictSelection | null; previous: DistrictSelection | null };
export interface MapEvents {
  /** Common selection envelope; existing change events retain their payloads. */
  selectionchange: MapSelectionChange;
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
  /** Fixed 800 × 800 projected space, not longitude/latitude. */
  get(): MapViewport;
  set(view: MapViewport, options?: CameraOptions): void;
  fit(geometry: Geometry, options?: CameraOptions & { padding?: number | MapPadding }): void;
  /** Delta in projected map units. */
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
  getResolvedConfiguration(): ResolvedMapConfiguration;
  getCapabilities(): MapCapabilities;
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
