const svgNamespace = 'http://www.w3.org/2000/svg';

type Point = { x: number; y: number };
type Ring = { length: number; center: Point; path: SVGPathElement };
type Morph = { path: SVGPathElement; from: Point[]; to: Point[] };

function rings(path: SVGPathElement): Ring[] {
  const pieces = (path.getAttribute('d') ?? '').match(/M[^M]*/g) ?? [];
  return pieces.map((piece) => {
    const ring = document.createElementNS(svgNamespace, 'path');
    ring.setAttribute('d', piece);
    const length = ring.getTotalLength();
    const center = ring.getPointAtLength(length / 2);
    return { length, center: { x: center.x, y: center.y }, path: ring };
  });
}

function sample(ring: Ring, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const point = ring.path.getPointAtLength((ring.length * index) / count);
    return { x: point.x, y: point.y };
  });
}

function align(from: Point[], to: Point[]): Point[] {
  const count = from.length;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestOffset = 0;
  let bestDirection = 1;
  for (const direction of [1, -1]) {
    for (let offset = 0; offset < count; offset++) {
      let score = 0;
      for (let index = 0; index < count; index += 4) {
        const a = from[index];
        const b = to[(offset + direction * index + count) % count];
        score += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      }
      if (score < bestScore) {
        bestScore = score;
        bestOffset = offset;
        bestDirection = direction;
      }
    }
  }
  return from.map((_, index) => to[(bestOffset + bestDirection * index + count) % count]);
}

function outline(svg: SVGSVGElement, district: number): Ring[] {
  const path = svg.querySelector<SVGPathElement>(
    `[data-layer="district-lines"] path[data-district="${district}"]`,
  );
  if (!path) throw new Error(`District ${district} has no outline`);
  return rings(path).sort((a, b) => b.length - a.length);
}

function pathData(from: Point[], to: Point[], progress: number): string {
  const coordinates = from.map((point, index) => {
    const target = to[index];
    const x = point.x + (target.x - point.x) * progress;
    const y = point.y + (target.y - point.y) * progress;
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `${coordinates.join('')}Z`;
}

/** Morph matched district outline rings; the source SVGs remain the exact year snapshots. */
export function createDistrictMorph(fromSvg: SVGSVGElement, toSvg: SVGSVGElement) {
  const layer = document.createElement('div');
  layer.className = 'history-layer history-morph';
  layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', toSvg.getAttribute('viewBox') ?? '0 0 800 800');
  const morphs: Morph[] = [];

  for (let district = 1; district <= 11; district++) {
    const fromRings = outline(fromSvg, district);
    const toRings = outline(toSvg, district);
    const count = Math.max(fromRings.length, toRings.length);
    for (let index = 0; index < count; index++) {
      const start = fromRings[index];
      const end = toRings[index];
      if (!start && !end) continue;
      const samples = Math.min(
        400,
        Math.max(64, Math.ceil(Math.max(start?.length ?? 0, end?.length ?? 0) / 3)),
      );
      const from = start
        ? sample(start, samples)
        : Array.from({ length: samples }, () => ({ ...end.center }));
      const to = end
        ? sample(end, samples)
        : Array.from({ length: samples }, () => ({ ...start.center }));
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#216c70');
      path.setAttribute('stroke-width', '1.7');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      morphs.push({ path, from, to: start && end ? align(from, to) : to });
    }
  }
  layer.append(svg);
  return {
    layer,
    update(progress: number) {
      for (const morph of morphs)
        morph.path.setAttribute('d', pathData(morph.from, morph.to, progress));
    },
    setOpacity(opacity: number) {
      svg.style.opacity = String(opacity);
    },
  };
}
