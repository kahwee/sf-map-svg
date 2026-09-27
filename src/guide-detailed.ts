import type {
  FeatureCollection,
  Geometry,
  KeyRoadProperties,
  LandmarkProperties,
  NeighborhoodProperties,
} from '../data/types.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { deepFreeze } from './immutable.js';

/** Load detailed selected geography only after the caller requests it. */
export async function loadGuideDetailedData(): Promise<InteractiveSFMapData> {
  const [coastData, neighborhoodData, parkData, highwayData, roadData, bartData] =
    await Promise.all([
      import('../data/coast.json', { with: { type: 'json' } }),
      import('../data/neighborhoods-realtor.json', { with: { type: 'json' } }),
      import('../data/landmarks.json', { with: { type: 'json' } }),
      import('../data/guide/highways-detailed.json', { with: { type: 'json' } }),
      import('../data/key-roads.json', { with: { type: 'json' } }),
      import('../data/bart-stations.json', { with: { type: 'json' } }),
    ]);
  const detailedNeighborhoods =
    neighborhoodData.default as unknown as FeatureCollection<NeighborhoodProperties>;
  const detailedRoads = roadData.default as unknown as FeatureCollection<KeyRoadProperties>;
  const detailedHighways = highwayData.default as unknown as FeatureCollection<{ route: string }>;
  const detailedParks = parkData.default as unknown as FeatureCollection<LandmarkProperties>;
  const detailedStations = bartData.default as unknown as FeatureCollection<{ name: string }>;
  return deepFreeze({
    map: {
      coast: coastData.default.features[0].geometry as unknown as Geometry,
      neighborhoods: detailedNeighborhoods.features.map((feature) => ({
        name: feature.properties.canonicalName,
        geometry: feature.geometry,
      })),
      highways: detailedHighways.features
        .filter((feature) => ['1', '101', '280'].includes(String(feature.properties.route)))
        .map((feature) => ({
          route: String(feature.properties.route),
          geometry: feature.geometry,
        })),
      landmarks: detailedParks.features.map(({ id, properties, geometry }) => ({
        id,
        ...properties,
        geometry,
      })),
      keyRoads: detailedRoads.features.map(({ id, properties, geometry }) => ({
        id,
        ...properties,
        geometry,
      })),
      bartStations: detailedStations.features.flatMap(({ id, properties, geometry }) =>
        geometry.type === 'Point'
          ? [{ id, name: properties.name, coordinates: geometry.coordinates }]
          : [],
      ),
    },
    neighborhoods: { realtor: detailedNeighborhoods },
  });
}
