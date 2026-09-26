import type {
  DistrictProperties,
  FeatureCollection,
  Geometry,
  NeighborhoodProperties,
  Position,
} from '../data/types.js';
export interface DistrictRow {
  id: number;
  label: Position;
  labelPoints: readonly Position[];
  geometry: Geometry;
  extras: Geometry | null;
}

// JSON files are the single source of geographic truth. This adapter preserves
// the renderer's compact internal shape and its original source display names.
import coast from '../data/coast.json' with { type: 'json' };
import districts2002 from '../data/districts-2002.json' with { type: 'json' };
import districts2012 from '../data/districts-2012.json' with { type: 'json' };
import districts2022 from '../data/districts-2022.json' with { type: 'json' };
import highways from '../data/highways.json' with { type: 'json' };
import neighborhoods from '../data/neighborhoods-realtor.json' with { type: 'json' };
import { deepFreeze } from './immutable.js';

const districtRows = (collection: FeatureCollection<DistrictProperties>): DistrictRow[] =>
  collection.features.map(({ geometry, properties }) => ({
    id: properties.district,
    label: properties.label,
    labelPoints: properties.labelPoints,
    geometry,
    extras: properties.displayExtras,
  }));

export default deepFreeze({
  coast: coast.features[0].geometry as unknown as Geometry,
  districts: {
    2002: districtRows(districts2002 as unknown as FeatureCollection<DistrictProperties>),
    2012: districtRows(districts2012 as unknown as FeatureCollection<DistrictProperties>),
    2022: districtRows(districts2022 as unknown as FeatureCollection<DistrictProperties>),
  },
  neighborhoods: (
    neighborhoods as unknown as FeatureCollection<NeighborhoodProperties>
  ).features.map(({ geometry, properties }) => ({
    name: properties.sourceName,
    geometry,
  })),
  highways: (highways as unknown as FeatureCollection<{ readonly route: string }>).features.map(
    ({ geometry, properties }) => ({
      route: properties.route,
      geometry,
    }),
  ),
});
