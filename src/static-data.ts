import { landmarks } from '../data/landmarks.js';
import { keyRoads } from '../data/roads.js';
import { bartStations } from '../data/stations.js';
import data from './data.js';
import { deepFreeze } from './immutable.js';
import type { StaticMapData } from './static.js';

/** Complete data for static rendering, without interactive lookup collections. */
export const staticMapData: StaticMapData = deepFreeze({
  coast: data.coast,
  districts: data.districts,
  neighborhoods: data.neighborhoods,
  highways: data.highways,
  landmarks: landmarks.features.map(({ id, properties, geometry }) => ({
    id,
    ...properties,
    geometry,
  })),
  keyRoads: keyRoads.features.map(({ id, properties, geometry }) => ({
    id,
    ...properties,
    geometry,
  })),
  bartStations: bartStations.features.flatMap(({ id, properties, geometry }) =>
    geometry.type === 'Point'
      ? [{ id, name: properties.name, coordinates: geometry.coordinates }]
      : [],
  ),
});
