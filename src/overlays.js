import parkData from '../data/landmarks.json' with { type: 'json' };
import stationData from '../data/bart-stations.json' with { type: 'json' };
import { deepFreeze } from './immutable.js';

export const landmarks = deepFreeze(
  parkData.features.map(({ id, properties, geometry }) => ({
    id,
    ...properties,
    geometry,
  })),
);
export const bartStations = deepFreeze(
  stationData.features.map(({ id, properties, geometry }) => ({
    id,
    name: properties.name,
    coordinates: geometry.coordinates,
  })),
);
