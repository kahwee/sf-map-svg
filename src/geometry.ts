import type { Bounds, Geometry, Position } from '../data/types.js';

export type { Bounds, Geometry, Position } from '../data/types.js';
export type Project = (position: Position) => [number, number];

const number = (value: number) => Number(value.toFixed(2));

export function rawProject([longitude, latitude]: Position): [number, number] {
  if (
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) >= 90
  )
    throw new RangeError(
      'Coordinates must be finite [longitude, latitude], with longitude from -180 to 180 and latitude strictly between -90 and 90.',
    );
  const point: [number, number] = [
    (longitude * Math.PI) / 180,
    -Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)),
  ];
  if (!point.every(Number.isFinite))
    throw new RangeError('Coordinates are too close to a pole for Mercator projection.');
  return point;
}
export function positions(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return [...geometry.coordinates];
    case 'Polygon':
    case 'MultiLineString':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(positions);
  }
}
export function geometryPath(geometry: Geometry | null | undefined, project: Project): string {
  if (!geometry) return '';
  const line = (ring: readonly Position[]) =>
    ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(number).join(',')}`).join('');
  const polygon = (rings: readonly (readonly Position[])[]) =>
    rings.map((ring) => `${line(ring)}Z`).join('');
  switch (geometry.type) {
    case 'Polygon':
      return polygon(geometry.coordinates);
    case 'MultiPolygon':
      return geometry.coordinates.map(polygon).join('');
    case 'LineString':
      return line(geometry.coordinates);
    case 'MultiLineString':
      return geometry.coordinates.map(line).join('');
    case 'GeometryCollection':
      return geometry.geometries.map((g) => geometryPath(g, project)).join('');
    default:
      return '';
  }
}

function validatePosition(point: Position): void {
  if (
    !Number.isFinite(point[0]) ||
    !Number.isFinite(point[1]) ||
    Math.abs(point[0]) > 180 ||
    Math.abs(point[1]) > 90
  )
    throw new RangeError('Expected finite longitude/latitude within [-180, 180] and [-90, 90].');
}

/** Geographic [west, south, east, north], or null for empty geometry. */
export function geometryBounds(geometry: Geometry | null | undefined): Bounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of positions(geometry)) {
    validatePosition(point);
    west = Math.min(west, point[0]);
    south = Math.min(south, point[1]);
    east = Math.max(east, point[0]);
    north = Math.max(north, point[1]);
  }
  return west === Infinity ? null : [west, south, east, north];
}

// 0 outside, 1 inside, 2 on an edge. Rings may be explicitly or implicitly closed.
function ringLocation(point: Position, ring: readonly Position[]): number {
  if (ring.length < 3) return 0;
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (
      cross === 0 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return 2;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside ? 1 : 0;
}

/** Polygon hit testing in longitude/latitude; boundaries (including hole edges) count as hits. */
export function geometryContainsPoint(
  geometry: Geometry | null | undefined,
  point: Position,
): boolean {
  validatePosition(point);
  // Validate the entire input, including parts not reached by the hit test.
  geometryBounds(geometry);
  const polygonContains = (rings: readonly (readonly Position[])[]) => {
    if (!rings.length) return false;
    const outer = ringLocation(point, rings[0]);
    if (outer === 0) return false;
    if (outer === 2) return true;
    let inHole = false;
    for (const ring of rings.slice(1)) {
      const location = ringLocation(point, ring);
      if (location === 2) return true;
      if (location === 1) inHole = true;
    }
    return !inHole;
  };
  const contains = (part: Geometry): boolean => {
    switch (part.type) {
      case 'Polygon':
        return polygonContains(part.coordinates);
      case 'MultiPolygon':
        return part.coordinates.some(polygonContains);
      case 'GeometryCollection':
        return part.geometries.some(contains);
      default:
        return false;
    }
  };
  return geometry ? contains(geometry) : false;
}
