import data from './data.js';
import type { SFMapData } from './map-core.js';
import { createSFMapWithData, districtColors, districtYears } from './map-core.js';
import { bartStations, keyRoads, landmarks } from './overlays.js';
import type { SFMapOptions } from './types.js';

export type { DistrictYear, MapMarker, MapOverlay, SFMapOptions } from './types.js';
export { districtColors, districtYears };
export const neighborhoodNames = Object.freeze(data.neighborhoods.map((item) => item.name));

const packagedData: SFMapData = {
  coast: data.coast,
  districts: data.districts,
  neighborhoods: data.neighborhoods,
  highways: data.highways,
  landmarks,
  keyRoads,
  bartStations,
};

/** Make an offline SVG and the matching longitude/latitude projection. */
export function createSFMap(options: SFMapOptions = {}) {
  return createSFMapWithData(options, packagedData);
}
export function renderSFMap(options: SFMapOptions = {}) {
  return createSFMap(options).svg;
}
