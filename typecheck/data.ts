import { createSFMap, renderSFMap } from '@kahwee/sf-map-svg';
import {
  catalog,
  districtMaps,
  getNeighborhood,
  searchNeighborhoods,
  type NeighborhoodSource,
} from '@kahwee/sf-map-svg/data';
import { geometryPath } from '@kahwee/sf-map-svg/geometry';
import rawNeighborhoods from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };

const source: NeighborhoodSource = 'realtor';
const mission = getNeighborhood('Inner Mission', { source });
const map = createSFMap({ landmarks: true, bartStations: true });
if (mission) {
  geometryPath(mission.geometry, map.project);
  // @ts-expect-error Public helper geometry is readonly.
  mission.properties.canonicalName = 'New name';
}
for (const feature of districtMaps[2022].features) {
  geometryPath(feature.geometry, map.project);
  geometryPath(feature.properties.displayExtras, map.project);
  map.project(feature.properties.label);
}
searchNeighborhoods('mission', { source: 'analysis' });
// @ts-expect-error Invalid source names must fail at compile time.
getNeighborhood('Mission', { source: 'missing' });
// @ts-expect-error Unsupported district year.
renderSFMap({ year: 2020 });
const name: string = rawNeighborhoods.features[0].properties.canonicalName;
const count: number = catalog.neighborhoods.length;
void [name, count];
