const svgNamespace = 'http://www.w3.org/2000/svg';

type Point = readonly [number, number];
interface Ring {
  length: number;
  center: Point;
  node: SVGPathElement;
}

function rings(d: string): Ring[] {
  return (d.match(/M[^M]*/g) ?? [])
    .map((piece) => {
      const node = document.createElementNS(svgNamespace, 'path');
      node.setAttribute('d', piece);
      const length = node.getTotalLength();
      const middle = node.getPointAtLength(length / 2);
      return { length, center: [middle.x, middle.y] as Point, node };
    })
    .filter((ring) => ring.length > 0)
    .sort((a, b) => b.length - a.length);
}

function sample(ring: Ring, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const point = ring.node.getPointAtLength((ring.length * index) / count);
    return [point.x, point.y] as Point;
  });
}

/** Rotate and orient `to` so each point travels the shortest total distance. */
function align(from: readonly Point[], to: readonly Point[]): Point[] {
  const count = from.length;
  let best = Number.POSITIVE_INFINITY;
  let bestOffset = 0;
  let bestDirection = 1;
  for (const direction of [1, -1]) {
    for (let offset = 0; offset < count; offset++) {
      let score = 0;
      for (let index = 0; index < count; index += 4) {
        const a = from[index];
        const b = to[(offset + direction * index + count * 2) % count];
        score += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
      }
      if (score < best) {
        best = score;
        bestOffset = offset;
        bestDirection = direction;
      }
    }
  }
  return from.map((_, index) => to[(bestOffset + bestDirection * index + count * 2) % count]);
}

interface Track {
  node: SVGPathElement;
  from: Point[];
  to: Point[];
}

const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Morph district outlines between two map years. Matching rings are resampled and aligned;
 * a ring without a partner grows from, or shrinks into, its partner's center. The real
 * district layers stay the exact year snapshots; this only draws a decorative overlay.
 */
export function createDistrictMorph() {
  let frame = 0;
  let overlay: SVGGElement | undefined;
  let lines: SVGElement | undefined;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    overlay?.remove();
    overlay = undefined;
    lines?.style.removeProperty('opacity');
    lines = undefined;
  }

  return {
    stop,
    /**
     * `previous` maps district id to its old outline path; the new outlines are read from
     * `layer`, which stays hidden until the morph settles into it.
     */
    start(
      layer: SVGGElement,
      previous: ReadonlyMap<string, string>,
      { duration, stroke }: { duration: number; stroke: string },
    ) {
      stop();
      const next = new Map(
        [...layer.querySelectorAll<SVGPathElement>('path[data-district]')].map((path) => [
          path.dataset.district ?? '',
          path.getAttribute('d') ?? '',
        ]),
      );
      const group = document.createElementNS(svgNamespace, 'g');
      group.dataset.layer = 'district-morph';
      group.setAttribute('aria-hidden', 'true');
      group.style.pointerEvents = 'none';
      const clip = layer.getAttribute('clip-path');
      if (clip) group.setAttribute('clip-path', clip);
      const tracks: Track[] = [];
      for (const id of new Set([...previous.keys(), ...next.keys()])) {
        const before = rings(previous.get(id) ?? '');
        const after = rings(next.get(id) ?? '');
        for (let index = 0; index < Math.max(before.length, after.length); index++) {
          const start = before[index];
          const end = after[index];
          if (!start && !end) continue;
          const count = Math.min(
            360,
            Math.max(48, Math.ceil(Math.max(start?.length ?? 0, end?.length ?? 0) / 3)),
          );
          const from = start
            ? sample(start, count)
            : Array.from({ length: count }, () => (end as Ring).center);
          const target = end
            ? sample(end, count)
            : Array.from({ length: count }, () => (start as Ring).center);
          const node = document.createElementNS(svgNamespace, 'path');
          for (const [name, value] of Object.entries({
            fill: 'none',
            stroke,
            'stroke-width': '1.6',
            'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke',
          }))
            node.setAttribute(name, value);
          group.append(node);
          tracks.push({ node, from, to: start && end ? align(from, target) : target });
        }
      }
      if (!tracks.length) return;
      overlay = group;
      lines = layer;
      layer.after(group);
      layer.style.opacity = '0';
      let begin: number | undefined;
      const draw = (progress: number) => {
        const t = ease(progress);
        for (const track of tracks) {
          let d = '';
          for (let index = 0; index < track.from.length; index++) {
            const [ax, ay] = track.from[index];
            const [bx, by] = track.to[index];
            d += `${index ? 'L' : 'M'}${(ax + (bx - ax) * t).toFixed(2)},${(ay + (by - ay) * t).toFixed(2)}`;
          }
          track.node.setAttribute('d', `${d}Z`);
        }
        // The morph hands over to the exact outlines in its final quarter.
        const settle = Math.max(0, (progress - 0.75) / 0.25);
        group.style.opacity = String(1 - settle);
        layer.style.opacity = String(settle);
      };
      draw(0);
      const tick = (time: number) => {
        begin ??= time;
        const progress = Math.min(1, (time - begin) / duration);
        draw(progress);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else stop();
      };
      frame = requestAnimationFrame(tick);
    },
    get active() {
      return overlay !== undefined;
    },
  };
}
