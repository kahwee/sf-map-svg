import { districtMaps, neighborhoodCollections } from '../data/index.js';
import { deepFreeze } from './immutable.js';
import type { MapData } from './map.js';
import { staticMapData } from './static-data.js';

/** Complete, explicit geographic preset. Import this only when all datasets are needed. */
export const fullMapData: MapData = deepFreeze({
  map: staticMapData,
  neighborhoods: neighborhoodCollections,
  districts: districtMaps,
});
