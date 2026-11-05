// Display-only simplification for generated map SVGs. Canonical GeoJSON and
// the full-precision downloads are untouched; this only shrinks images that are
// shown at a known on-screen size.

/** Perpendicular distance from p to segment ab. */
function distance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  if (!length) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas–Peucker with an explicit stack. Keeps the first and last points. */
function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let farthest = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distance(points[i], points[start], points[end]);
      if (d > farthest) {
        farthest = d;
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

const format = (value, digits) => String(Number(value.toFixed(digits)));

/** Simplify one absolute M/L/Z path string. Rings that collapse are dropped. */
export function simplifyPath(d, tolerance, digits = 1) {
  const out = [];
  for (const ring of d.split(/(?=M)/)) {
    const closed = /Z\s*$/i.test(ring);
    const points = [...ring.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    if (!points.length) continue;
    const kept = simplifyLine(points, tolerance);
    if (closed && kept.length < 4) continue;
    let text = '';
    let last;
    kept.forEach(([x, y], i) => {
      const pair = `${format(x, digits)},${format(y, digits)}`;
      if (pair === last) return;
      text += `${i ? 'L' : 'M'}${pair}`;
      last = pair;
    });
    out.push(closed ? `${text}Z` : text);
  }
  return out.join('');
}

/** Simplify every path `d` attribute in an SVG document string. */
export function simplifySvg(svg, tolerance, digits = 1) {
  return svg.replace(/ d="([^"]+)"/g, (_, d) => ` d="${simplifyPath(d, tolerance, digits)}"`);
}
