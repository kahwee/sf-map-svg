import { deepFreeze } from '../src/immutable.js';
import coastData from './coast.json' with { type: 'json' };
import type { FeatureCollection } from './types.js';

export const coast = deepFreeze(
  coastData as unknown as FeatureCollection<{ readonly name: string }>,
);
