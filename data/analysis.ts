import { deepFreeze } from '../src/immutable.js';
import analysisData from './neighborhoods-analysis.json' with { type: 'json' };
import type { FeatureCollection, NeighborhoodProperties } from './types.js';

export const analysisNeighborhoods = deepFreeze(
  analysisData as unknown as FeatureCollection<NeighborhoodProperties>,
);
