const number = (value) => Number(value.toFixed(2));

export function rawProject([longitude, latitude]) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) >= 90)
    throw new RangeError(
      'Coordinates must be finite [longitude, latitude], with latitude between -90 and 90.',
    );
  return [
    (longitude * Math.PI) / 180,
    -Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)),
  ];
}
export function positions(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(positions);
  const result = [];
  const walk = (coordinates) => {
    if (typeof coordinates[0] === 'number') result.push(coordinates);
    else coordinates.forEach(walk);
  };
  walk(geometry.coordinates);
  return result;
}
export function geometryPath(geometry, project) {
  if (!geometry) return '';
  const line = (ring) =>
    ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(number).join(',')}`).join('');
  const polygon = (rings) => rings.map((ring) => `${line(ring)}Z`).join('');
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
