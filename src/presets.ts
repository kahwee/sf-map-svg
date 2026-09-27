import type { MapOptions } from './controller-types.js';
import { deepFreeze } from './immutable.js';
/** Configuration only: pair with guide/data or a compatible caller-supplied dataset. */
export const guideOptions: Readonly<MapOptions> = deepFreeze({
  mode: 'neighborhoods',
  layers: {
    districtFills: false,
    districtLines: false,
    districtLabels: false,
    neighborhoodLines: true,
    neighborhoodLabels: true,
    landmarks: true,
    bartStations: true,
    highways: true,
    keyRoads: true,
    roadLabels: true,
  },
});
