import { deepFreeze } from '../src/immutable.js';
import roadData from './key-roads.json' with { type: 'json' };
import type { FeatureCollection, KeyRoadProperties } from './types.js';

export const keyRoads = deepFreeze(roadData as unknown as FeatureCollection<KeyRoadProperties>);
