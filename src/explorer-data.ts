import type {
  DistrictProperties,
  FeatureCollection,
  NeighborhoodProperties,
  NeighborhoodSource,
} from '../data/types.js';
import type { SFMapData } from './map-core.js';
import type { DistrictYear } from './types.js';

/** Geographic inputs for the data-injected interactive map entry point. */
export interface InteractiveSFMapData {
  map: SFMapData;
  districts?: Partial<Readonly<Record<DistrictYear, FeatureCollection<DistrictProperties>>>>;
  neighborhoods: Partial<
    Readonly<Record<NeighborhoodSource, FeatureCollection<NeighborhoodProperties>>>
  >;
}
