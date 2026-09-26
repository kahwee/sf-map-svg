import { guideMapData } from './guide-data.js';
import type { InteractiveSFMapElement, InteractiveSFMapOptions } from './interactive-data.js';
import { createInteractiveSFMapWithData } from './interactive-data.js';

/** Guide map preset: SFAR neighborhoods, major parks, BART, and curated roads. */
export function createGuideMap(options: InteractiveSFMapOptions = {}): InteractiveSFMapElement {
  return createInteractiveSFMapWithData(guideMapData, {
    mode: 'neighborhoods',
    ...options,
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
      ...options.layers,
    },
  });
}
