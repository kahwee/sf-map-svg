import type { Geometry, Position } from '../data/types.js';
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
