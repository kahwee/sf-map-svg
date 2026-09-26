import { deepFreeze } from '../src/immutable.js';
import sfFindData from './neighborhoods.json' with { type: 'json' };
import type { FeatureCollection, NeighborhoodProperties } from './types.js';

export const sfFindNeighborhoods = deepFreeze(
  sfFindData as unknown as FeatureCollection<NeighborhoodProperties>,
);
