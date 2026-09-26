import { deepFreeze } from '../src/immutable.js';
import landmarkData from './landmarks.json' with { type: 'json' };
import type { FeatureCollection, LandmarkProperties } from './types.js';

export const landmarks = deepFreeze(
  landmarkData as unknown as FeatureCollection<LandmarkProperties>,
);
