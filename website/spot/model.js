// Point lookup across the three neighborhood definitions and three district maps.
// `data` has the library's MapData shape: `neighborhoods` collections and `districts` maps.

export const neighborhoodSources = [
  { id: 'realtor', label: 'SFAR', detail: 'Realtor areas · 2010' },
  { id: 'sf-find', label: 'SF Find', detail: 'City neighborhood names · 2006' },
  { id: 'analysis', label: 'Analysis', detail: 'City analysis areas' },
];
export const districtYears = [2002, 2012, 2022];

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

export function identifySpot(point, data) {
  return {
    neighborhoods: neighborhoodSources.map((source) => ({
      ...source,
      matches: (data.neighborhoods[source.id]?.features ?? []).filter((feature) =>
        containsPoint(feature, point),
      ),
    })),
    districts: districtYears.map((year) => ({
      year,
      feature: data.districts[year]?.features.find((feature) => containsPoint(feature, point)),
    })),
  };
}
