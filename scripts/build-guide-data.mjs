import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findOverlaps, removeOverlaps } from './lib/topology.js';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)));
const out = new URL('../data/guide/', import.meta.url);
await mkdir(out, { recursive: true });
const key = (point) => `${point[0].toPrecision(14)},${point[1].toPrecision(14)}`;
const project = ([x, y]) => [x * Math.cos((37.77 * Math.PI) / 180), y];
const distanceToSegment = (point, start, end) => {
  const p = project(point),
    a = project(start),
    b = project(end);
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const simplifyLine = (line, tolerance) => {
  if (line.length <= 2) return line;
  const keep = new Set([0, line.length - 1]);
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let max = tolerance,
      index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(line[i], line[start], line[end]);
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (index !== -1) {
      keep.add(index);
      stack.push([start, index], [index, end]);
    }
  }
  return line.filter((_, index) => keep.has(index));
};
const ringsIn = (geometry) => {
  const rings = [];
  const visit = (g) => {
    if (!g) return;
    if (g.type === 'Polygon') rings.push(...g.coordinates);
    else if (g.type === 'MultiPolygon') rings.push(...g.coordinates.flat());
    else if (g.type === 'GeometryCollection') g.geometries.forEach(visit);
  };
  visit(geometry);
  return rings;
};

// Simplify the realtor coverage as a shared vertex graph. Maximal boundary arcs
// are simplified once and the same retained vertices are reused by both areas.
const realtor = await read('neighborhoods-realtor');
const nodes = new Map();
const edges = new Set();
for (const feature of realtor.features)
  for (const ring of ringsIn(feature.geometry)) {
    for (let i = 1; i < ring.length; i++) {
      const a = key(ring[i - 1]),
        b = key(ring[i]);
      if (a === b) continue;
      const edge = [a, b].sort().join('|');
      edges.add(edge);
      for (const [id, point, neighbor] of [
        [a, ring[i - 1], b],
        [b, ring[i], a],
      ]) {
        const node = nodes.get(id) ?? { point, neighbors: new Set() };
        node.neighbors.add(neighbor);
        nodes.set(id, node);
      }
    }
  }
const pending = new Set(edges);
const retained = new Set();
const edgeId = (a, b) => [a, b].sort().join('|');
const simplifyArc = (arc) => {
  for (const point of simplifyLine(
    arc.map((id) => nodes.get(id).point),
    0.00009,
  ))
    retained.add(key(point));
};
for (const [start, node] of nodes) {
  if (node.neighbors.size === 2) continue;
  retained.add(start);
  for (const first of node.neighbors) {
    if (!pending.has(edgeId(start, first))) continue;
    pending.delete(edgeId(start, first));
    const arc = [start, first];
    let previous = start,
      current = first;
    while (nodes.get(current).neighbors.size === 2) {
      const next = [...nodes.get(current).neighbors].find((candidate) => candidate !== previous);
      if (!next || !pending.has(edgeId(current, next))) break;
      pending.delete(edgeId(current, next));
      arc.push(next);
      previous = current;
      current = next;
    }
    retained.add(current);
    simplifyArc(arc);
  }
}
// Any all-degree-two loops are rare; anchor them deterministically and simplify
// both halves so reversing a shared ring produces the same retained vertices.
while (pending.size) {
  const [firstEdge] = pending;
  const [start] = firstEdge.split('|');
  const next = [...nodes.get(start).neighbors].sort()[0];
  const arc = [start];
  let previous = start,
    current = next;
  pending.delete(edgeId(previous, current));
  while (current !== start) {
    arc.push(current);
    const candidate = [...nodes.get(current).neighbors].find((id) => id !== previous);
    if (!candidate || !pending.has(edgeId(current, candidate))) break;
    pending.delete(edgeId(current, candidate));
    previous = current;
    current = candidate;
  }
  const midpoint = Math.floor(arc.length / 2);
  simplifyArc(arc.slice(0, midpoint + 1));
  simplifyArc([...arc.slice(midpoint), start]);
}
const simplifyTopology = (geometry) => {
  const ring = (coordinates) => {
    const next = coordinates.filter((point) => retained.has(key(point)));
    if (next.length < 3) return coordinates;
    if (key(next[0]) !== key(next[next.length - 1])) next.push(next[0]);
    return next.length >= 4 ? next : coordinates;
  };
  if (geometry.type === 'Polygon')
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(ring),
    };
  if (geometry.type === 'MultiPolygon')
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map(ring)),
    };
  return geometry;
};
const reducedFeature = (feature, geometry) => ({
  type: 'Feature',
  id: feature.id,
  bbox: feature.bbox,
  properties: feature.properties,
  geometry,
});
const collection = (original, id, title, features) => ({
  type: 'FeatureCollection',
  schemaVersion: 1,
  id,
  title,
  coordinateSystem: original.coordinateSystem,
  definition: original.definition,
  sources: original.sources,
  features,
});
const trimmedCoast = await read('coast');
const overviewCoast = collection(trimmedCoast, 'guide-coast-overview', 'Guide coastline overview', [
  reducedFeature(
    trimmedCoast.features[0],
    simplifyGeometry(trimmedCoast.features[0].geometry, 0.00022),
  ),
]);
function simplifyGeometry(geometry, tolerance) {
  const line = (coordinates) => simplifyLine(coordinates, tolerance);
  const ring = (coordinates) => {
    if (coordinates.length <= 4 || key(coordinates[0]) !== key(coordinates.at(-1)))
      return coordinates;
    const open = coordinates.slice(0, -1);
    let pivot = 2;
    for (let index = 3; index < open.length - 1; index++)
      if (
        distanceToSegment(open[index], open[0], open[0]) >
        distanceToSegment(open[pivot], open[0], open[0])
      )
        pivot = index;
    const simplifyArc = (arc) => {
      const simplified = line(arc);
      if (simplified.length >= 3) return simplified;
      let farthest = 1;
      for (let index = 2; index < arc.length - 1; index++)
        if (
          distanceToSegment(arc[index], arc[0], arc.at(-1)) >
          distanceToSegment(arc[farthest], arc[0], arc.at(-1))
        )
          farthest = index;
      return [arc[0], arc[farthest], arc.at(-1)];
    };
    const firstArc = simplifyArc(open.slice(0, pivot + 1));
    const secondArc = simplifyArc([...open.slice(pivot), open[0]]);
    const simplified = [...firstArc.slice(0, -1), ...secondArc];
    return simplified.length >= 4 ? simplified : coordinates;
  };
  switch (geometry.type) {
    case 'LineString':
      return { ...geometry, coordinates: line(geometry.coordinates) };
    case 'MultiLineString':
      return { ...geometry, coordinates: geometry.coordinates.map(line) };
    case 'Polygon':
      return { ...geometry, coordinates: geometry.coordinates.map(ring) };
    case 'MultiPolygon':
      return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map(ring)) };
    default:
      return geometry;
  }
}
function bboxOf(geometry) {
  const points = [];
  const visit = (value) => {
    if (Array.isArray(value) && typeof value[0] === 'number') points.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(geometry.coordinates);
  return points.reduce(
    (bounds, [x, y]) => [
      Math.min(bounds[0], x),
      Math.min(bounds[1], y),
      Math.max(bounds[2], x),
      Math.max(bounds[3], y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}
await writeFile(new URL('coast.json', out), `${JSON.stringify(overviewCoast)}\n`);
const simplifiedNeighborhoodFeatures = realtor.features.map((feature) => {
  const geometry = simplifyTopology(feature.geometry);
  return {
    ...reducedFeature(feature, geometry),
    bbox: bboxOf(geometry),
    properties: Object.fromEntries(
      ['name', 'canonicalName', 'sourceName', 'aliases', 'definitionSource', 'nameSources']
        .filter((name) => feature.properties[name] !== undefined)
        .map((name) => [name, feature.properties[name]]),
    ),
  };
});
const slimNeighborhoods = collection(
  realtor,
  'guide-neighborhoods-overview',
  'SFAR neighborhood overview',
  removeOverlaps({ ...realtor, features: simplifiedNeighborhoodFeatures }).features,
);
if (findOverlaps(slimNeighborhoods.features).length)
  throw new Error('Guide neighborhood boundaries overlap after shared-arc simplification.');
await writeFile(
  new URL('neighborhoods-realtor.json', out),
  `${JSON.stringify(slimNeighborhoods)}\n`,
);
const parks = await read('landmarks');
const parkFeatures = parks.features.map((feature) =>
  reducedFeature(feature, simplifyGeometry(feature.geometry, 0.00012)),
);
await writeFile(
  new URL('landmarks.json', out),
  `${JSON.stringify(collection(parks, 'guide-parks-overview', 'Major park outlines', parkFeatures))}\n`,
);
const highways = await read('highways');
const roadRoutes = new Set(['1', '101', '280']);
const selectedHighways = highways.features
  .filter((feature) => roadRoutes.has(String(feature.properties.route)))
  .map((feature) => reducedFeature(feature, simplifyGeometry(feature.geometry, 0.00007)));
await writeFile(
  new URL('highways.json', out),
  `${JSON.stringify(collection(highways, 'guide-highways', 'Selected San Francisco highways', selectedHighways))}\n`,
);
const detailedHighways = highways.features.filter((feature) =>
  roadRoutes.has(String(feature.properties.route)),
);
await writeFile(
  new URL('highways-detailed.json', out),
  `${JSON.stringify(collection(highways, 'guide-highways-detailed', 'Selected San Francisco highways (detailed)', detailedHighways))}\n`,
);
const roads = await read('key-roads');
const selectedRoads = roads.features.map((feature) => ({
  ...reducedFeature(feature, simplifyGeometry(feature.geometry, 0.00005)),
  properties: {
    name: feature.properties.name,
    level: feature.properties.level,
    label: feature.properties.label,
  },
}));
await writeFile(
  new URL('key-roads.json', out),
  `${JSON.stringify(collection(roads, 'guide-key-roads', 'Curated guide streets', selectedRoads))}\n`,
);
const stations = await read('bart-stations');
await writeFile(
  new URL('bart-stations.json', out),
  `${JSON.stringify(
    collection(
      stations,
      'guide-bart-stations',
      'San Francisco BART stations',
      stations.features.map((feature) => ({
        ...feature,
        properties: { name: feature.properties.name },
      })),
    ),
  )}\n`,
);
console.log(
  `Wrote guide preset: ${realtor.features.length} neighborhoods, ${selectedHighways.length} highway segments, ${selectedRoads.length} streets.`,
);
