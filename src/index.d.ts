export type DistrictYear = 2002 | 2012 | 2022;
export interface MapMarker { id: string; lng: number; lat: number; label?: string; selected?: boolean; color?: string }
export interface SFMapOptions {
  width?: number; height?: number; padding?: number; year?: DistrictYear;
  districtLines?: boolean; neighborhoodLines?: boolean; districtFills?: boolean;
  districtLabels?: boolean; highways?: boolean; markers?: MapMarker[];
  title?: string; idPrefix?: string;
  colors?: Partial<Record<'water'|'land'|'district'|'neighborhood'|'highway'|'label'|'marker'|'selected', string>>;
}
export declare const districtYears: readonly DistrictYear[];
export declare const neighborhoodNames: readonly string[];
export declare const districtColors: readonly string[];
export declare function createSFMap(options?: SFMapOptions): {svg: string; project: (coordinates: [number, number]) => [number, number]; viewBox: [number, number, number, number]};
export declare function renderSFMap(options?: SFMapOptions): string;
