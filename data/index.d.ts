export type Position = readonly [number, number, ...number[]];
export type Bounds = readonly [number, number, number, number];
export type Geometry =
  | { readonly type: 'Point'; readonly coordinates: Position }
  | { readonly type: 'LineString' | 'MultiPoint'; readonly coordinates: readonly Position[] }
  | {
      readonly type: 'Polygon' | 'MultiLineString';
      readonly coordinates: readonly (readonly Position[])[];
    }
  | {
      readonly type: 'MultiPolygon';
      readonly coordinates: readonly (readonly (readonly Position[])[])[];
    }
  | { readonly type: 'GeometryCollection'; readonly geometries: readonly Geometry[] };
export interface Feature<P = Readonly<Record<string, unknown>>> {
  readonly type: 'Feature';
  readonly id: string;
  readonly bbox: Bounds;
  readonly properties: P;
  readonly geometry: Geometry;
}
export interface DataSource {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly retrievedAt: string;
  readonly definitionYear?: number;
  readonly licenseUrl: string;
}
export interface Definition {
  readonly kind: string;
  readonly year?: number;
  readonly description: string;
}
export interface FeatureCollection<P = Readonly<Record<string, unknown>>> {
  readonly type: 'FeatureCollection';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly coordinateSystem: string;
  readonly definition: Definition;
  readonly sources: readonly DataSource[];
  readonly topology?: {
    readonly policy: 'disjoint-interiors';
    readonly sharedBoundariesAllowed: boolean;
    readonly method: string;
    readonly tool: string;
    readonly processedAt: string;
    readonly sourceOverlapPairs: number;
  };
  readonly features: readonly Feature<P>[];
}
export type NeighborhoodSource = 'sf-find' | 'analysis' | 'realtor';
export interface NeighborhoodProperties {
  readonly name: string;
  readonly canonicalName: string;
  readonly sourceName: string;
  readonly aliases: readonly string[];
  readonly definitionSource: NeighborhoodSource;
  readonly nameSources: readonly string[];
  readonly note?: string;
  readonly sourceCode?: string;
  readonly realtorDistrict?: string;
}
export interface NeighborhoodEntry extends NeighborhoodProperties {
  readonly id: string;
  readonly source: NeighborhoodSource;
  readonly file: string;
  readonly bbox: Bounds;
}
export interface DistrictProperties {
  readonly district: number;
  readonly name: string;
  readonly year: 2002 | 2012 | 2022;
  readonly label: Position;
  readonly labelPoints: readonly Position[];
  readonly displayExtras: Geometry | null;
}
export interface Catalog {
  readonly schemaVersion: 1;
  readonly description: string;
  readonly datasets: readonly {
    readonly id: string;
    readonly file: string;
    readonly title: string;
    readonly featureCount: number;
    readonly definition: Definition;
    readonly sources: readonly DataSource[];
  }[];
  readonly neighborhoods: readonly NeighborhoodEntry[];
}
export declare const coast: FeatureCollection<{ readonly name: string }>;
export declare const districtMaps: Readonly<
  Record<2002 | 2012 | 2022, FeatureCollection<DistrictProperties>>
>;
export declare const neighborhoods: FeatureCollection<NeighborhoodProperties>;
export declare const neighborhoodCollections: Readonly<
  Record<NeighborhoodSource, FeatureCollection<NeighborhoodProperties>>
>;
export declare const neighborhoodSources: readonly NeighborhoodSource[];
export declare const highways: FeatureCollection<{ readonly route: string }>;
export declare const landmarks: FeatureCollection<{
  readonly name: string;
  readonly label: Position;
  readonly offset: readonly [number, number];
  readonly anchor: 'middle' | 'start' | 'end';
}>;
export declare const bartStations: FeatureCollection<{ readonly name: string }>;
export declare const catalog: Catalog;
export declare function getNeighborhood(
  name: string,
  options?: { source?: NeighborhoodSource },
): Feature<NeighborhoodProperties> | undefined;
export declare function searchNeighborhoods(
  query?: string,
  options?: { source?: NeighborhoodSource },
): NeighborhoodEntry[];
