import { deepFreeze } from '../src/immutable.js';
import highwayData from './highways.json' with { type: 'json' };
import type { FeatureCollection } from './types.js';

export const highways = deepFreeze(
  highwayData as unknown as FeatureCollection<{ readonly route: string }>,
);
