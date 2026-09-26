import { positions } from './geometry.js';

export function projectedBounds(geometry, project) {
  return positions(geometry)
    .map(project)
    .reduce(
      (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
      [Infinity, Infinity, -Infinity, -Infinity],
    );
}

/** Find an interior label anchor using even-odd scanline intervals, including holes. */
export function interiorAnchor(geometry, project) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best;
  let bestScore = -Infinity;
  for (const polygon of polygons) {
    const rings = polygon.map((ring) => ring.map(project));
    const ys = rings[0].map((p) => p[1]);
    const lo = Math.min(...ys),
      hi = Math.max(...ys);
    for (let step = 1; step < 32; step++) {
      const y = lo + ((hi - lo) * step) / 32;
      const intersections = [];
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i],
            b = ring[j];
          if (a[1] > y !== b[1] > y)
            intersections.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const width = intersections[i + 1] - intersections[i];
        const score = width * (1 - Math.abs(step - 16) / 64);
        if (width > 0 && score > bestScore) {
          bestScore = score;
          best = [(intersections[i] + intersections[i + 1]) / 2, y];
        }
      }
    }
  }
  return best;
}

export function clampView([x, y, size]) {
  size = Math.max(800 / 12, Math.min(800, size));
  return [Math.max(0, Math.min(800 - size, x)), Math.max(0, Math.min(800 - size, y)), size];
}
export function fitBounds([minX, minY, maxX, maxY], padding = 0.18) {
  const size = Math.max(
    800 / 12,
    Math.min(800, Math.max(maxX - minX, maxY - minY) * (1 + padding * 2)),
  );
  return clampView([(minX + maxX - size) / 2, (minY + maxY - size) / 2, size]);
}

/** Candidates arrive in priority order and carry measured screen-pixel widths. */
export function layoutLabels(candidates, width, height) {
  const placed = [];
  for (const candidate of candidates) {
    const { x, y, textWidth, textHeight = 15, offset = 0 } = candidate;
    const alternatives = offset
      ? [
          [x + offset, y - textHeight / 2],
          [x - offset - textWidth, y - textHeight / 2],
          [x - textWidth / 2, y - offset - textHeight],
        ]
      : [[x - textWidth / 2, y - textHeight / 2]];
    for (const [left, top] of alternatives) {
      const box = [left - 3, top - 3, left + textWidth + 3, top + textHeight + 3];
      if (box[0] < 2 || box[1] < 2 || box[2] > width - 2 || box[3] > height - 2) continue;
      if (
        placed.some(
          ({ box: b }) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
        )
      )
        continue;
      placed.push({ ...candidate, left, top, box });
      break;
    }
  }
  return placed;
}
