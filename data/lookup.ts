import { analysisNeighborhoods } from './analysis.js';
import { findNeighborhood } from './lookup-utils.js';
import { neighborhoods } from './realtor.js';
import { sfFindNeighborhoods } from './sf-find.js';
import type { FeatureCollection, NeighborhoodProperties, NeighborhoodSource } from './types.js';

export const neighborhoodCollections: Readonly<
  Record<NeighborhoodSource, FeatureCollection<NeighborhoodProperties>>
> = Object.freeze({
  'sf-find': sfFindNeighborhoods,
  analysis: analysisNeighborhoods,
  realtor: neighborhoods,
});

export const neighborhoodSources = Object.freeze(
  Object.keys(neighborhoodCollections) as NeighborhoodSource[],
);

/** Exact ID, canonical name, source name, or alias lookup within one definition set. */
export function getNeighborhood(
  name: string,
  { source = 'realtor' }: { source?: NeighborhoodSource } = {},
) {
  if (!Object.hasOwn(neighborhoodCollections, source))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
  return findNeighborhood(name, neighborhoodCollections[source]);
}
