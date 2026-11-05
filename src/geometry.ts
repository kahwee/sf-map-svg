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
/** Walk collections without recursion or copying their coordinate arrays. */
function* geometryParts(geometry: Geometry | null | undefined): Generator<Geometry> {
  if (!geometry) return;
  const stack = [geometry];
  for (let part = stack.pop(); part; part = stack.pop()) {
    if (part.type === 'GeometryCollection') {
      for (let i = part.geometries.length - 1; i >= 0; i--) stack.push(part.geometries[i]);
    } else {
      yield part;
    }
  }
}

function visitPositions(
  geometry: Geometry | null | undefined,
  visit: (position: Position) => void,
): void {
  const line = (points: readonly Position[]) => {
    for (const point of points) visit(point);
  };
  for (const part of geometryParts(geometry)) {
    switch (part.type) {
      case 'Point':
        visit(part.coordinates);
        break;
      case 'LineString':
      case 'MultiPoint':
        line(part.coordinates);
        break;
      case 'Polygon':
      case 'MultiLineString':
        for (const ring of part.coordinates) line(ring);
        break;
      case 'MultiPolygon':
        for (const polygon of part.coordinates) for (const ring of polygon) line(ring);
        break;
    }
  }
}

export function positions(geometry: Geometry | null | undefined): Position[] {
  return Array.from(geometryParts(geometry)).flatMap((part) => {
    switch (part.type) {
      case 'Point':
        return [part.coordinates];
      case 'LineString':
      case 'MultiPoint':
        return part.coordinates;
      case 'Polygon':
      case 'MultiLineString':
        return part.coordinates.flat();
      case 'MultiPolygon':
        return part.coordinates.flat(2);
      default:
        return [];
    }
  });
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
  visitPositions(geometry, (point) => {
    validatePosition(point);
    west = Math.min(west, point[0]);
    south = Math.min(south, point[1]);
    east = Math.max(east, point[0]);
    north = Math.max(north, point[1]);
  });
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
  visitPositions(geometry, validatePosition);
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
  for (const part of geometryParts(geometry)) {
    if (part.type === 'Polygon' && polygonContains(part.coordinates)) return true;
    if (part.type === 'MultiPolygon' && part.coordinates.some(polygonContains)) return true;
  }
  return false;
}
