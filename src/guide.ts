import bart from '../data/guide/bart-stations.json' with { type: 'json' };
import coast from '../data/guide/coast.json' with { type: 'json' };
import highways from '../data/guide/highways.json' with { type: 'json' };
import roads from '../data/guide/key-roads.json' with { type: 'json' };
import landmarks from '../data/guide/landmarks.json' with { type: 'json' };
import neighborhoods from '../data/guide/neighborhoods-realtor.json' with { type: 'json' };
import type {
  FeatureCollection,
  Geometry,
  KeyRoadProperties,
  LandmarkProperties,
  NeighborhoodProperties,
} from '../data/types.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { InteractiveSFMapElement, InteractiveSFMapOptions } from './interactive-data.js';
import { createInteractiveSFMapWithData } from './interactive-data.js';

const neighborhoodData = neighborhoods as unknown as FeatureCollection<NeighborhoodProperties>;
const highwayData = highways as unknown as FeatureCollection<{ route: string }>;
const parkData = landmarks as unknown as FeatureCollection<LandmarkProperties>;
const roadData = roads as unknown as FeatureCollection<KeyRoadProperties>;
const stationData = bart as unknown as FeatureCollection<{ name: string }>;

/** Compact, source-aware San Francisco guide data. Imports no district or alternate-neighborhood files. */
export const guideMapData: InteractiveSFMapData = {
  map: {
    coast: coast.features[0].geometry as unknown as Geometry,
    neighborhoods: neighborhoodData.features.map((feature) => ({
      name: feature.properties.canonicalName,
      geometry: feature.geometry,
    })),
    highways: highwayData.features.map((feature) => ({
      route: String(feature.properties.route),
      geometry: feature.geometry,
    })),
    landmarks: parkData.features.map(({ id, properties, geometry }) => ({
      id,
      ...properties,
      geometry,
    })),
    keyRoads: roadData.features.map(({ id, properties, geometry }) => ({
      id,
      ...properties,
      sourceNames: properties.sourceNames ?? [],
      segmentIds: properties.segmentIds ?? [],
      geometry,
    })),
    bartStations: stationData.features.flatMap(({ id, properties, geometry }) =>
      geometry.type === 'Point'
        ? [{ id, name: properties.name, coordinates: geometry.coordinates }]
        : [],
    ),
  },
  neighborhoods: { realtor: neighborhoodData },
};

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

/** Load the detailed versions of the guide's selected geography on explicit request. */
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
  return {
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
  };
}

export type { InteractiveSFMapData } from './explorer-data.js';
export type { InteractiveSFMapElement, InteractiveSFMapOptions };
