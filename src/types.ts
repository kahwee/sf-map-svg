export type DistrictYear = 2002 | 2012 | 2022;
export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  selected?: boolean;
  color?: string;
}
export interface SFMapOptions {
  width?: number;
  height?: number;
  padding?: number;
  year?: DistrictYear;
  districtLines?: boolean;
  neighborhoodLines?: boolean;
  districtFills?: boolean;
  districtLabels?: boolean;
  highways?: boolean;
  landmarks?: boolean;
  bartStations?: boolean;
  markers?: MapMarker[];
  title?: string;
  idPrefix?: string;
  colors?: Partial<
    Record<
      | 'water'
      | 'land'
      | 'district'
      | 'neighborhood'
      | 'highway'
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
