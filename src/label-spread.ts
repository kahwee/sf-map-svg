/** Choose a limited, well-spaced set from labels that already passed collision checks. */
export function spreadLabels<T extends { point: [number, number]; kind: string }>(
  labels: readonly T[],
  limit: number | undefined,
  markers: readonly [number, number][],
  width: number,
  height: number,
): readonly T[] {
  if (limit === undefined || labels.length <= limit) return labels;
  if (limit === 0) return [];
  const distance = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1]);
  const diagonal = Math.hypot(width, height);
  const remaining = [...labels];
  const selected: T[] = [];
  const priority = remaining.findIndex((label) => label.kind === 'selected-marker');
  if (priority >= 0) selected.push(...remaining.splice(priority, 1));
  while (selected.length < limit && remaining.length) {
    let best = 0;
    let bestScore = -Infinity;
    remaining.forEach((label, index) => {
      const spacing = selected.length
        ? Math.min(...selected.map((other) => distance(label.point, other.point))) / diagonal
        : 0;
      const proximity = markers.length
        ? 1 -
          markers.reduce(
            (nearest, marker) => Math.min(nearest, distance(label.point, marker)),
            diagonal,
          ) /
            diagonal
        : 0;
      // Prefer coverage, with nearby pins adding context. Original priority breaks ties.
      const score = spacing * 0.75 + proximity * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    selected.push(...remaining.splice(best, 1));
  }
  return selected;
}
