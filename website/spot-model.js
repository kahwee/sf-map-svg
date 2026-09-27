import districts2002 from '../data/districts-2002.json';
import districts2012 from '../data/districts-2012.json';
import districts2022 from '../data/districts-2022.json';
import sfFind from '../data/neighborhoods.json';
import analysis from '../data/neighborhoods-analysis.json';
import realtor from '../data/neighborhoods-realtor.json';

export const neighborhoodSources = [
  { id: 'realtor', label: 'SFAR', detail: 'Realtor areas · 2010', collection: realtor },
  { id: 'sf-find', label: 'SF Find', detail: 'City neighborhood names · 2006', collection: sfFind },
  { id: 'analysis', label: 'Analysis', detail: 'City analysis areas', collection: analysis },
];

export const districtYears = [
  { year: 2002, collection: districts2002 },
  { year: 2012, collection: districts2012 },
  { year: 2022, collection: districts2022 },
];

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(point, rings) {
  return inRing(point, rings[0]) && !rings.slice(1).some((ring) => inRing(point, ring));
}

export function containsPoint(feature, point) {
  const [x, y] = point;
  const bounds = feature.bbox;
  if (bounds && (x < bounds[0] || y < bounds[1] || x > bounds[2] || y > bounds[3])) return false;
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.some((polygon) => inPolygon(point, polygon));
  return false;
}

export function identifySpot(point) {
  return {
    neighborhoods: neighborhoodSources.map((source) => ({
      ...source,
      matches: source.collection.features.filter((feature) => containsPoint(feature, point)),
    })),
    districts: districtYears.map(({ year, collection }) => ({
      year,
      feature: collection.features.find((feature) => containsPoint(feature, point)),
    })),
  };
}
