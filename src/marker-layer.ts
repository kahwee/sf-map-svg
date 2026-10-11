import { svgElement } from './dom.js';
import type { normalizeFeatures } from './features.js';
import type { MapMarker } from './types.js';

export interface MarkerVisual {
  node: SVGGElement;
  dot: SVGCircleElement;
  hit: SVGCircleElement;
  ring: SVGCircleElement;
  title: SVGTitleElement;
}

export interface MarkerItem {
  marker: MapMarker;
  point: [number, number];
  index: number;
  enter: boolean;
  visual: MarkerVisual | undefined;
}

/** Own marker visuals and entrances; selection/events remain with the controller. */
export function createMarkerLayer() {
  const records = new Set<MarkerItem>();
  const animations = new Map<SVGGElement, Animation>();
  function cancelEntrances() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
    for (const item of records) item.enter = false;
  }
  return {
    cancelEntrances,
    remove(item: MarkerItem) {
      const visual = item.visual;
      if (visual) {
        animations.get(visual.node)?.cancel();
        animations.delete(visual.node);
        visual.node.remove();
      }
      records.delete(item);
      item.enter = false;
    },
    update(item: MarkerItem, marker: MapMarker, point: [number, number], index: number) {
      const visual = item.visual;
      if (visual) {
        if (item.point[0] !== point[0] || item.point[1] !== point[1])
          visual.node.setAttribute('transform', `translate(${point[0]},${point[1]})`);
        const label = marker.label ?? marker.id;
        if (visual.title.textContent !== label) {
          visual.title.textContent = label;
          visual.node.setAttribute('aria-label', label);
        }
        if (item.index !== index) visual.node.style.setProperty('--sf-marker-index', String(index));
      }
      item.marker = marker;
      item.point = point;
      item.index = index;
    },
    add(marker: MapMarker, point: [number, number], index: number): MarkerItem {
      const item = { marker, point, index, enter: true, visual: undefined };
      records.add(item);
      return item;
    },
    materialize(
      item: MarkerItem,
      {
        features,
        markerColor,
        selectedMarkerColor,
        reducedMotion,
        selected,
      }: {
        features: ReturnType<typeof normalizeFeatures>;
        markerColor: string;
        selectedMarkerColor: string;
        reducedMotion: boolean;
        selected: boolean;
      },
    ): MarkerVisual {
      if (item.visual) return item.visual;
      const { marker, point, index, enter } = item;
      item.enter = false;
      const node = svgElement('g', {
        transform: `translate(${point[0]},${point[1]})`,
        'data-marker-id': marker.id,
        role: 'button',
        tabindex: -1,
        'aria-label': marker.label ?? marker.id,
        'aria-pressed': String(selected),
      });
      const hit = svgElement('circle', { fill: 'transparent', 'pointer-events': 'all' });
      const dot = svgElement('circle', {
        fill: selected ? selectedMarkerColor : (marker.color ?? markerColor),
        stroke: '#fff9e9',
        'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
      });
      const title = svgElement('title');
      title.textContent = marker.label ?? marker.id;
      const ring = svgElement('circle', {
        fill: 'none',
        stroke: features.selectedMarkerRing
          ? (features.selectedMarkerRing.color ?? selectedMarkerColor)
          : selectedMarkerColor,
        'stroke-width': features.selectedMarkerRing ? features.selectedMarkerRing.width : 2,
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
        display: selected && features.selectedMarkerRing ? 'inline' : 'none',
      });
      node.style.setProperty('--sf-marker-index', String(index));
      node.append(title, hit, ring, dot);
      if (features.markerEntrance && enter && !reducedMotion && typeof dot.animate === 'function') {
        const animation = dot.animate(
          [
            { opacity: 0, transform: 'translateY(-12px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: features.markerEntrance.duration,
            delay: Math.min(index * features.markerEntrance.stagger, 1000),
            easing: 'cubic-bezier(.2,.8,.2,1)',
            fill: 'backwards',
          },
        );
        animations.set(node, animation);
        const release = () => {
          if (animations.get(node) === animation) animations.delete(node);
        };
        animation.finished.then(release, release);
      }

      const visual = { node, dot, hit, ring, title };
      item.visual = visual;
      return visual;
    },
  };
}
