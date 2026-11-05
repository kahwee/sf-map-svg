/** Stable seed-distance groups with a spatial index, independent of input order and the DOM. */
export function clusterPoints<
  T extends { marker: { id: string }; point: readonly [number, number] },
>(items: readonly T[], unit: number, radius: number): T[][] {
  const cellSize = unit * radius;
  if (!Number.isFinite(cellSize) || cellSize <= 0)
    throw new RangeError('Cluster scale and radius must be positive and finite.');
  const cells = new Map<string, T[][]>();
  const groups: T[][] = [];
  for (const item of [...items].sort((a, b) =>
    a.marker.id < b.marker.id ? -1 : a.marker.id > b.marker.id ? 1 : 0,
  )) {
    const [x, y] = item.point;
    const cx = Math.floor(x / cellSize),
      cy = Math.floor(y / cellSize);
    let nearest: T[] | undefined,
      distance = cellSize;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        for (const candidate of cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const d = Math.hypot(x - candidate[0].point[0], y - candidate[0].point[1]);
          if (d < distance) {
            nearest = candidate;
            distance = d;
          }
        }
      }
    if (nearest) nearest.push(item);
    else {
      const group = [item],
        key = `${cx}:${cy}`;
      groups.push(group);
      const cell = cells.get(key) ?? [];
      cell.push(group);
      cells.set(key, cell);
    }
  }
  return groups;
}
