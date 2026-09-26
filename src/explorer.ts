import {
  bartStations,
  districtMaps,
  keyRoads,
  landmarks,
  neighborhoodCollections,
} from '../data/index.js';
import data from './data.js';
import { createNeighborhoodExplorerCore } from './explorer-core.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { NeighborhoodExplorerElement, NeighborhoodExplorerOptions } from './types.js';

export type {
  ExplorerMode,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
} from './types.js';

const packagedData: InteractiveSFMapData = {
  map: {
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
  },
  neighborhoods: neighborhoodCollections,
  districts: districtMaps,
};

/** Create an offline, browser-only neighborhood explorer with package datasets. */
export function createNeighborhoodExplorer(
  options: NeighborhoodExplorerOptions = {},
): NeighborhoodExplorerElement {
  return createNeighborhoodExplorerCore(options, packagedData);
}
