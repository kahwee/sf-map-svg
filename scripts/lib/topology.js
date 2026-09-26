import polygonClipping from 'polygon-clipping';

const intersectsBounds = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Shared edges and vertices are allowed; any nonempty polygon intersection fails. */
export function findOverlaps(features) {
  const overlaps = [];
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i];
      const b = features[j];
      if (!intersectsBounds(a.bbox, b.bbox)) continue;
      if (polygonClipping.intersection(a.geometry.coordinates, b.geometry.coordinates).length) {
        overlaps.push([a.id, b.id]);
      }
    }
  }
  return overlaps;
}

/** Assign shared area to the lexicographically first stable ID, independent of file order. */
export function removeOverlaps(collection) {
  const result = structuredClone(collection);
  const sorted = [...result.features].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // A second pass can resolve floating-point residues from a previous difference.
  // Abort rather than silently accepting residual overlaps after the bounded retry.
  for (let pass = 0; pass < 5; pass++) {
    if (!findOverlaps(sorted).length) return result;
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const prior = sorted
        .slice(0, i)
        .filter(
          (other) =>
            intersectsBounds(current.bbox, other.bbox) &&
            polygonClipping.intersection(current.geometry.coordinates, other.geometry.coordinates)
              .length,
        );
      if (!prior.length) continue;
      const coordinates = polygonClipping.difference(
        current.geometry.coordinates,
        ...prior.map((f) => f.geometry.coordinates),
      );
      if (!coordinates.length)
        throw new Error(`Normalization would erase ${current.id}; review the source definitions.`);
      current.geometry = { type: 'MultiPolygon', coordinates };
      const points = coordinates.flat(2);
      current.bbox = points.reduce(
        (bounds, [x, y]) => [
          Math.min(bounds[0], x),
          Math.min(bounds[1], y),
          Math.max(bounds[2], x),
          Math.max(bounds[3], y),
        ],
        [Infinity, Infinity, -Infinity, -Infinity],
      );
    }
  }
  if (findOverlaps(sorted).length) throw new Error('Overlap normalization did not converge.');
  return result;
}
