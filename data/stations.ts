import { deepFreeze } from '../src/immutable.js';
import stationData from './bart-stations.json' with { type: 'json' };
import type { FeatureCollection } from './types.js';

export const bartStations = deepFreeze(
  stationData as unknown as FeatureCollection<{ readonly name: string }>,
);
