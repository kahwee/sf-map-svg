export type * from './types.js';

import { deepFreeze } from '../src/immutable.js';
import stationData from './bart-stations.json' with { type: 'json' };
import catalogData from './catalog.json' with { type: 'json' };
import coastData from './coast.json' with { type: 'json' };
import districts2002 from './districts-2002.json' with { type: 'json' };
import districts2012 from './districts-2012.json' with { type: 'json' };
import districts2022 from './districts-2022.json' with { type: 'json' };
import highwayData from './highways.json' with { type: 'json' };
import roadData from './key-roads.json' with { type: 'json' };
import landmarkData from './landmarks.json' with { type: 'json' };
import sfFind from './neighborhoods.json' with { type: 'json' };
import analysis from './neighborhoods-analysis.json' with { type: 'json' };
import realtor from './neighborhoods-realtor.json' with { type: 'json' };
import type {
  Catalog,
  DistrictProperties,
  Feature,
  FeatureCollection,
  KeyRoadProperties,
  LandmarkProperties,
  NeighborhoodProperties,
  NeighborhoodSource,
} from './types.js';

export const coast = deepFreeze(
  coastData as unknown as FeatureCollection<{ readonly name: string }>,
);
export const districtMaps: Readonly<
  Record<2002 | 2012 | 2022, FeatureCollection<DistrictProperties>>
> = deepFreeze({
  2002: districts2002 as unknown as FeatureCollection<DistrictProperties>,
  2012: districts2012 as unknown as FeatureCollection<DistrictProperties>,
  2022: districts2022 as unknown as FeatureCollection<DistrictProperties>,
});
export const neighborhoods = deepFreeze(
  realtor as unknown as FeatureCollection<NeighborhoodProperties>,
);
export const neighborhoodCollections = deepFreeze({
  'sf-find': sfFind,
  analysis,
  realtor,
} as unknown as Readonly<Record<NeighborhoodSource, FeatureCollection<NeighborhoodProperties>>>);
export const neighborhoodSources = Object.freeze(
  Object.keys(neighborhoodCollections) as NeighborhoodSource[],
);
export const highways = deepFreeze(
  highwayData as unknown as FeatureCollection<{ readonly route: string }>,
);
export const landmarks = deepFreeze(
  landmarkData as unknown as FeatureCollection<LandmarkProperties>,
);
export const bartStations = deepFreeze(
  stationData as unknown as FeatureCollection<{ readonly name: string }>,
);
export const catalog = deepFreeze(catalogData as unknown as Catalog);

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function checkSource(source: string) {
  if (!Object.hasOwn(neighborhoodCollections, source))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
}
const names = (feature: Feature<NeighborhoodProperties>) => [
  feature.id,
  feature.properties.canonicalName,
  feature.properties.sourceName,
  ...feature.properties.aliases,
];

/** Exact ID, canonical name, source name, or alias lookup within one definition set. */
export function getNeighborhood(
  name: string,
  { source = 'realtor' }: { source?: NeighborhoodSource } = {},
) {
  checkSource(source);
  if (typeof name !== 'string') throw new TypeError('Neighborhood name must be a string.');
  const query = normalize(name);
  if (!query) return undefined;
  return neighborhoodCollections[source].features.find((feature) =>
    names(feature).some((value) => normalize(value) === query),
  );
}

/** Search names across sources; results keep their source identity and omit geometry. */
export function searchNeighborhoods(query = '', { source }: { source?: NeighborhoodSource } = {}) {
  if (source !== undefined) checkSource(source);
  if (typeof query !== 'string') throw new TypeError('Neighborhood query must be a string.');
  const term = normalize(query);
  return catalog.neighborhoods.filter(
    (entry) =>
      (source === undefined || entry.source === source) &&
      [entry.id, entry.canonicalName, entry.sourceName, ...entry.aliases].some((value) =>
        normalize(value).includes(term),
      ),
  );
}

export const keyRoads = deepFreeze(roadData as unknown as FeatureCollection<KeyRoadProperties>);
