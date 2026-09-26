import stationData from '../data/bart-stations.json' with { type: 'json' };
import roadData from '../data/key-roads.json' with { type: 'json' };
import parkData from '../data/landmarks.json' with { type: 'json' };
import type {
  FeatureCollection,
  KeyRoadProperties,
  LandmarkProperties,
  Position,
} from '../data/types.js';
import { deepFreeze } from './immutable.js';

export const landmarks = deepFreeze(
  (parkData as unknown as FeatureCollection<LandmarkProperties>).features.map(
    ({ id, properties, geometry }) => ({
      id,
      ...properties,
      geometry,
    }),
  ),
);
export const bartStations = deepFreeze(
  stationData.features.map(({ id, properties, geometry }) => ({
    id,
    name: properties.name,
    coordinates: geometry.coordinates as unknown as Position,
  })),
);

export type Landmark = (typeof landmarks)[number];
export type BartStation = (typeof bartStations)[number];

export const keyRoads = deepFreeze(
  (roadData as unknown as FeatureCollection<KeyRoadProperties>).features.map(
    ({ id, properties, geometry }) => ({ id, ...properties, geometry }),
  ),
);
export type KeyRoad = (typeof keyRoads)[number];
