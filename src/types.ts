import type { Geometry, NeighborhoodFeature, NeighborhoodSource } from '../data/types.js';

export type DistrictYear = 2002 | 2012 | 2022;
export interface DistrictSelection {
  id: number;
  year: DistrictYear;
  district: import('./map-core.js').DistrictRowData;
}
export interface DistrictStyle {
  fill?: string;
  stroke?: string;
  opacity?: number;
}
export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  selected?: boolean;
  color?: string;
  /** Visible radius in screen pixels (interactive), SVG units (static). */
  radius?: number;
}
export interface MapOverlay {
  id: string;
  geometry: Extract<
    Geometry,
    { type: 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' }
  >;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
  visible?: boolean;
  label?: string;
}
export interface SFMapOptions {
  /** Grouped presentation; supplied keys take precedence over flat compatibility options. */
  layers?: StaticMapLayers;
  appearance?: StaticMapAppearance;
  theme?: 'districts' | 'transit';
  width?: number;
  height?: number;
  padding?: number;
  year?: DistrictYear;
  /** Select a supplied neighborhood definition when rendering source-aware MapData. */
  source?: NeighborhoodSource;
  districtLines?: boolean;
  neighborhoodLines?: boolean;
  districtFills?: boolean;
  /** Evaluated once per district at construction/style/year updates; call setDistrictStyle again when external data changes. */
  districtStyle?: (district: import('./map-core.js').DistrictRowData) => DistrictStyle;
  districtLabels?: boolean;
  /** Hide all visible text labels while retaining geographic symbols and accessible titles. */
  labels?: boolean;
  highways?: boolean;
  keyRoads?: boolean;
  roadLabels?: boolean;
  landmarks?: boolean;
  bartStations?: boolean;
  markers?: readonly MapMarker[];
  overlays?: readonly MapOverlay[];
  title?: string;
  idPrefix?: string;
  /**
   * Opt-in, self-contained CSS choreography for static SVGs: land fades in, the coast and
   * lines draw, districts grow, then labels and points appear. It plays when the SVG is
   * inserted into a page or loaded as an image, and stays still under reduced motion.
   * `duration` (default 2400 ms) scales the whole sequence; `delay` offsets it.
   */
  animation?: boolean | { duration?: number; delay?: number };
  colors?: Partial<
    Record<
      | 'water'
      | 'land'
      | 'district'
      | 'neighborhood'
      | 'highway'
      | 'road'
      | 'park'
      | 'landmark'
      | 'bart'
      | 'label'
      | 'marker'
      | 'selected',
      string
    >
  >;
}

/** Presentation supported by both the static and interactive renderers. */
export type StaticMapLayers = Omit<InteractiveLayers, 'neighborhoodLabels'>;
export type StaticMapAppearance = Pick<SFMapOptions, 'theme' | 'colors' | 'districtStyle'>;

/** Serializable viewport in the interactive map's fixed 800 × 800 projected space. */
export type MapViewport = readonly [x: number, y: number, size: number];
export type ExplorerMode = 'neighborhoods' | 'districts' | 'basemap';
export interface MapPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
export interface InteractiveLayers {
  districtFills?: boolean;
  districtLines?: boolean;
  districtLabels?: boolean;
  neighborhoodLines?: boolean;
  neighborhoodLabels?: boolean;
  landmarks?: boolean;
  bartStations?: boolean;
  highways?: boolean;
  keyRoads?: boolean;
  roadLabels?: boolean;
}
export interface NeighborhoodSelection {
  id: string;
  name: string;
  source: NeighborhoodSource;
  feature: NeighborhoodFeature;
}
export interface MapFeatures {
  /** Opt-in camera motion; reduced-motion always takes precedence. */
  motion?: boolean | { duration?: number };
  markerEntrance?: boolean | { duration?: number; stagger?: number };
  selectedMarkerRing?: boolean | { color?: string; width?: number; gap?: number };
  /** Screen-space clustering. The selected marker and full chooser remain available. */
  clustering?: boolean | { radius?: number };
  northArrow?: boolean;
  scaleBar?: boolean;
  /**
   * Fade layers as `setLayers` and `setMode` switch them, crossfade neighborhood boundaries
   * when `setSource` changes the definition, and crossfade district fills on
   * `setDistrictStyle`. Reduced motion takes precedence.
   */
  layerTransitions?: boolean | { duration?: number };
  /**
   * Morph district outlines from one map year to the next on `setDistrictYear`; pass
   * `{ animate: false }` for an instant change. Reduced motion takes precedence.
   */
  districtMorph?: boolean | { duration?: number };
}
export interface NeighborhoodExplorerOptions extends MapFeatures {
  mode?: ExplorerMode;
  labels?: boolean;
  source?: NeighborhoodSource;
  neighborhood?: string;
  year?: DistrictYear;
  theme?: SFMapOptions['theme'];
  colors?: SFMapOptions['colors'];
  labelStyle?: { fontFamily?: string; fontWeight?: number; haloColor?: string };
  areaStyle?: {
    selectedFill?: string;
    selectedStroke?: string;
    hoverFill?: string;
    hoverStroke?: string;
  };
  districtStyle?: SFMapOptions['districtStyle'];
  legend?: {
    builtins?: boolean;
    hidden?: readonly ('bart' | 'park' | 'highway' | 'road')[];
    items?: readonly { label: string; color: string }[];
  };
  attribution?: 'full' | 'compact';

  /** Explorer chrome or the reusable map with only controls and attribution. */
  interface?: 'explorer' | 'map';
  /** Independent overrides; omitted layers follow mode defaults. */
  layers?: InteractiveLayers;
  selectableNeighborhoods?: boolean;
  /** Screen pixels; defaults preserve 11px roads / 12px other labels. */
  labelSize?: { min?: number; max?: number };
  /** Screen-pixel space reserved when fitting geometry. */
  fitPadding?: number | MapPadding;
  markers?: readonly MapMarker[];
  /** Screen pixels, independent of zoom. */
  markerRadius?: number;
  markerHitSize?: number;
  markerColor?: string;
  selectedMarkerColor?: string;
  onMarkerActivate?: (marker: MapMarker) => void;
  overlays?: readonly MapOverlay[];
  onOverlayActivate?: (overlay: MapOverlay) => void;
  /** Stable theme tokens consumed by the explorer chrome. */
  style?: Partial<
    Record<'ink' | 'surface' | 'accent' | 'border' | 'focus' | 'controlGap' | 'font', string>
  >;
  strings?: Partial<
    Record<
      | 'title'
      | 'mode'
      | 'source'
      | 'search'
      | 'chooseNeighborhood'
      | 'chooseMarker'
      | 'touchNavigation'
      | 'touchNavigationLabel'
      | 'touchNavigationExitLabel'
      | 'touchNavigationDone'
      | 'reset'
      | 'emptyResults'
      | 'gestureHelp',
      string
    >
  >;
  /**
   * Independently hide chrome. `neighborhoodPicker` and `markerPicker` hide the native
   * choosers (supply your own accessible list); `help` keeps the gesture help as the map's
   * accessible description; `status` keeps a visually hidden live region. Attribution stays.
   */
  controls?: Partial<
    Record<
      | 'zoom'
      | 'pan'
      | 'reset'
      | 'labels'
      | 'touch'
      | 'legend'
      | 'neighborhoodPicker'
      | 'markerPicker'
      | 'help'
      | 'status',
      boolean
    >
  >;
}
export interface CameraOptions {
  animate?: boolean;
  duration?: number;
}
export interface NeighborhoodExplorerElement extends HTMLElement {
  /** Append positioned HTML children here; coordinates are relative to this layer. */
  readonly overlayElement: HTMLDivElement;
  projectToScreen(lng: number, lat: number): { x: number; y: number; visible: boolean };
  stopAnimation(): void;
  /** Atomic patch; false disables, undefined resets a feature to its default. */
  setFeatures(patch: MapFeatures): void;
  getFeatures(): MapFeatures;
  /** Layer overrides; undefined restores mode defaults. Preserves camera and selection. */
  setLayers(patch: InteractiveLayers): void;
  /** Chrome switches are independent. */
  setControls(patch: NonNullable<NeighborhoodExplorerOptions['controls']>): void;
  selectNeighborhood(name: string | null, options?: { fit?: boolean } & CameraOptions): boolean;
  getSelection(): NeighborhoodSelection | null;
  selectDistrict(id: number | null, options?: { fit?: boolean } & CameraOptions): boolean;
  getSelectedDistrict(): DistrictSelection | null;
  setDistrictYear(year: DistrictYear, options?: CameraOptions): void;
  setDistrictStyle(style: SFMapOptions['districtStyle']): void;
  setSource(source: NeighborhoodSource): void;
  setMode(mode: ExplorerMode): void;
  setLabels(visible: boolean): void;
  resetView(options?: CameraOptions): void;
  zoomBy(factor: number, options?: CameraOptions): void;
  panBy(x: number, y: number, options?: CameraOptions): void;
  getViewport(): MapViewport;
  setViewport(view: MapViewport, options?: CameraOptions): void;
  /** Fit WGS84 geometry, including Point, MultiPoint, or a GeometryCollection. */
  fitGeometry(geometry: Geometry, padding?: number | MapPadding, options?: CameraOptions): void;
  /** Explicitly engage map touch gestures; false restores page gestures. */
  setTouchNavigation(enabled: boolean): void;
  /** Reconcile stable IDs; preserve cached nodes, focus, and entrances. Offscreen pins detach. */
  setMarkers(markers: readonly MapMarker[]): void;
  setOverlays(overlays: readonly MapOverlay[]): void;
  selectMarker(id: string | null, options?: { fit?: boolean } & CameraOptions): boolean;
  getSelectedMarker(): MapMarker | null;
  destroy(): void;
}

/** Paused-by-default schematic BART animation with keyboard-operable controls. */
export interface TransitAnimationElement extends HTMLElement {
  destroy(): void;
}

export type {
  MapAppearance,
  MapCamera,
  MapCapabilities,
  MapConfiguration,
  MapConfigurationSnapshot,
  MapController,
  MapControls,
  MapEvents,
  MapFeatureReference,
  MapOptions,
  MapSelectionChange,
  MapViewUpdateOptions,
  ResolvedMapConfiguration,
} from './controller-types.js';
