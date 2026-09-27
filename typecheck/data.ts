import { createMap, renderMap } from '@kahwee/sf-map-svg';
import {
  catalog,
  districtMaps,
  getNeighborhood,
  type NeighborhoodSource,
  searchNeighborhoods,
} from '@kahwee/sf-map-svg/data';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';
import rawNeighborhoods from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with {
  type: 'json',
};
import { geometryPath } from '@kahwee/sf-map-svg/geometry';

const source: NeighborhoodSource = 'realtor';
const mission = getNeighborhood('Inner Mission', { source });
const map = renderMap(fullMapData.map, { landmarks: true, bartStations: true });
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
renderMap(fullMapData.map, { year: 2020 });
const name: string = rawNeighborhoods.features[0].properties.canonicalName;
const count: number = catalog.neighborhoods.length;
void [name, count];

const explorer = createMap(fullMapData, { source: 'realtor', neighborhood: 'NoPa' });
explorer.selectNeighborhood('Outer Mission');
explorer.setSource('analysis');
explorer.setMode('districts');
explorer.setLabels(false);
// @ts-expect-error Unknown map modes must fail at compile time.
explorer.setMode('unknown');
explorer.camera.zoom(2);
explorer.camera.reset();
explorer.destroy();
