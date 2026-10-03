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
  PointFeatureCollection,
} from '../data/types.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { deepFreeze } from './immutable.js';

const neighborhoodData = neighborhoods as unknown as FeatureCollection<NeighborhoodProperties>;
const highwayData = highways as unknown as FeatureCollection<{ route: string }>;
const parkData = landmarks as unknown as FeatureCollection<LandmarkProperties>;
const roadData = roads as unknown as FeatureCollection<KeyRoadProperties>;
const stationData = bart as unknown as PointFeatureCollection<{ name: string }>;

/** Compact, source-aware geography with no district or alternate-neighborhood files. */
export const guideMapData: InteractiveSFMapData = deepFreeze({
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
});
