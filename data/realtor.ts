import { deepFreeze } from '../src/immutable.js';
import { findNeighborhood } from './lookup-utils.js';
import realtorData from './neighborhoods-realtor.json' with { type: 'json' };
import type { FeatureCollection, NeighborhoodProperties } from './types.js';

export const neighborhoods = deepFreeze(
  realtorData as unknown as FeatureCollection<NeighborhoodProperties>,
);

/** Look up one SFAR area without importing the other neighborhood definitions. */
export function getRealtorNeighborhood(name: string) {
  return findNeighborhood(name, neighborhoods);
}
