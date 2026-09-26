import type { Geometry, NeighborhoodFeature, NeighborhoodSource } from '../data/types.js';

export type DistrictYear = 2002 | 2012 | 2022;
export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  selected?: boolean;
  color?: string;
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
  theme?: 'districts' | 'transit';
  width?: number;
  height?: number;
  padding?: number;
  year?: DistrictYear;
  districtLines?: boolean;
  neighborhoodLines?: boolean;
  districtFills?: boolean;
  districtLabels?: boolean;
  /** Hide all visible text labels while retaining geographic symbols and accessible titles. */
  labels?: boolean;
  highways?: boolean;
  keyRoads?: boolean;
  roadLabels?: boolean;
  landmarks?: boolean;
  bartStations?: boolean;
  markers?: MapMarker[];
  overlays?: readonly MapOverlay[];
  title?: string;
  idPrefix?: string;
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
export interface NeighborhoodExplorerOptions {
  mode?: ExplorerMode;
  labels?: boolean;
  source?: NeighborhoodSource;
  neighborhood?: string;
  year?: DistrictYear;
  theme?: SFMapOptions['theme'];
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
      | 'reset'
      | 'emptyResults'
      | 'gestureHelp',
      string
    >
  >;
  controls?: Partial<Record<'zoom' | 'pan' | 'reset' | 'labels' | 'touch' | 'legend', boolean>>;
}
export interface NeighborhoodExplorerElement extends HTMLElement {
  selectNeighborhood(name: string | null, options?: { fit?: boolean }): boolean;
  getSelection(): NeighborhoodSelection | null;
  setSource(source: NeighborhoodSource): void;
  setMode(mode: ExplorerMode): void;
  setLabels(visible: boolean): void;
  resetView(): void;
  zoomBy(factor: number): void;
  panBy(x: number, y: number): void;
  getViewport(): MapViewport;
  setViewport(view: MapViewport): void;
  /** Fit WGS84 geometry, including Point, MultiPoint, or a GeometryCollection. */
  fitGeometry(geometry: Geometry, padding?: number | MapPadding): void;
  /** Explicitly engage map touch gestures; false restores page gestures. */
  setTouchNavigation(enabled: boolean): void;
  setMarkers(markers: readonly MapMarker[]): void;
  setOverlays(overlays: readonly MapOverlay[]): void;
  selectMarker(id: string | null, options?: { fit?: boolean }): boolean;
  getSelectedMarker(): MapMarker | null;
  destroy(): void;
}

/** Paused-by-default schematic BART animation with keyboard-operable controls. */
export interface TransitAnimationElement extends HTMLElement {
  destroy(): void;
}
