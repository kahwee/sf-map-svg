// Display-only simplification of the explicit map dataset for the Pages site.
// Canonical data in data/ is untouched; the site loads this lighter copy so the
// real createMap and renderMap APIs can run without megabytes of geometry.

// Degrees of latitude. About 2 m, well under a pixel at the interactive map's zoom levels.
export const SITE_TOLERANCE = 0.00002;
const latitudeScale = Math.cos((37.76 * Math.PI) / 180);

function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = (bx - ax) * latitudeScale;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    let farthest = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const px = (points[i][0] - ax) * latitudeScale;
      const py = points[i][1] - ay;
      const t = length ? Math.max(0, Math.min(1, (px * dx + py * dy) / length)) : 0;
      const distance = Math.hypot(px - t * dx, py - t * dy);
      if (distance > farthest) {
        farthest = distance;
        index = i;
      }
    }
    if (farthest > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = ([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];

function simplifyGeometry(geometry, tolerance) {
  const line = (points) => simplifyLine(points, tolerance).map(round);
  const ring = (points) => {
    const kept = line(points);
    return kept.length >= 4 ? kept : null;
  };
  switch (geometry.type) {
    case 'Point':
      return { ...geometry, coordinates: round(geometry.coordinates) };
    case 'MultiPoint':
      return { ...geometry, coordinates: geometry.coordinates.map(round) };
    case 'LineString':
      return { ...geometry, coordinates: line(geometry.coordinates) };
    case 'MultiLineString':
      return { ...geometry, coordinates: geometry.coordinates.map(line) };
    case 'Polygon': {
      const rings = geometry.coordinates.map(ring);
      // Keep the exterior even when tiny, so every feature still has a shape.
      return {
        ...geometry,
        coordinates: rings[0] ? rings.filter(Boolean) : geometry.coordinates.slice(0, 1),
      };
    }
    case 'MultiPolygon': {
      const polygons = geometry.coordinates
        .map((polygon) => polygon.map(ring))
        .filter((polygon) => polygon[0])
        .map((polygon) => polygon.filter(Boolean));
      return { ...geometry, coordinates: polygons.length ? polygons : geometry.coordinates };
    }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((item) => simplifyGeometry(item, tolerance)),
      };
    default:
      return geometry;
  }
}

const isGeometry = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.type === 'string' &&
  ('coordinates' in value || 'geometries' in value);

/** Deep copy of any dataset shape with every GeoJSON geometry simplified. */
export function simplifyDataset(value, tolerance = SITE_TOLERANCE) {
  if (Array.isArray(value)) return value.map((item) => simplifyDataset(item, tolerance));
  if (isGeometry(value)) return simplifyGeometry(value, tolerance);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, simplifyDataset(item, tolerance)]),
    );
  return value;
}
