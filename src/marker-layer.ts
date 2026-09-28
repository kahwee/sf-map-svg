import { svgElement } from './dom.js';
import type { normalizeFeatures } from './features.js';
import type { MapMarker } from './types.js';

export interface MarkerItem {
  marker: MapMarker;
  point: [number, number];
  node: SVGGElement;
  dot: SVGCircleElement;
  hit: SVGCircleElement;
  ring: SVGCircleElement;
  title: SVGTitleElement;
}

/** Own marker visuals and entrances; selection/events remain with the controller. */
export function createMarkerLayer(layer: SVGGElement) {
  const animations = new Map<SVGGElement, Animation>();
  function cancelEntrances() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
  }
  return {
    cancelEntrances,
    clear() {
      cancelEntrances();
      layer.replaceChildren();
    },
    remove(item: MarkerItem) {
      animations.get(item.node)?.cancel();
      animations.delete(item.node);
      item.node.remove();
    },
    update(item: MarkerItem, marker: MapMarker, point: [number, number], index: number) {
      if (item.point[0] !== point[0] || item.point[1] !== point[1])
        item.node.setAttribute('transform', `translate(${point[0]},${point[1]})`);
      const label = marker.label ?? marker.id;
      if (item.title.textContent !== label) {
        item.title.textContent = label;
        item.node.setAttribute('aria-label', label);
      }
      if (item.node.style.getPropertyValue('--sf-marker-index') !== String(index))
        item.node.style.setProperty('--sf-marker-index', String(index));
      item.marker = marker;
      item.point = point;
    },
    add(
      marker: MapMarker,
      point: [number, number],
      index: number,
      {
        features,
        markerColor,
        selectedMarkerColor,
        reducedMotion,
        enter,
      }: {
        features: ReturnType<typeof normalizeFeatures>;
        markerColor: string;
        selectedMarkerColor: string;
        reducedMotion: boolean;
        enter: boolean;
      },
    ): MarkerItem {
      const node = svgElement('g', {
        transform: `translate(${point[0]},${point[1]})`,
        'data-marker-id': marker.id,
        role: 'button',
        tabindex: 0,
        'aria-label': marker.label ?? marker.id,
        'aria-pressed': 'false',
      });
      const hit = svgElement('circle', { fill: 'transparent', 'pointer-events': 'all' });
      const dot = svgElement('circle', {
        fill: marker.color ?? markerColor,
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
        display: 'none',
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

      layer.append(node);
      return { marker, point, node, dot, hit, ring, title };
    },
  };
}
