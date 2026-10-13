import { clusterPoints } from './clusters.js';
import { setAttributeIfChanged, svgElement } from './dom.js';
import type { normalizeFeatures } from './features.js';
import type { MarkerItem, MarkerVisual } from './marker-layer.js';
import type { createMarkerNavigation } from './marker-navigation.js';
import type { MapViewport } from './types.js';

interface ClusterState {
  unit: number;
  view: MapViewport;
  items: MarkerItem[];
  revision: number;
  selected: string | null;
  features: ReturnType<typeof normalizeFeatures>;
  markerColor: string;
  markerRadius: number;
  markerHitSize: number;
}

interface MarkerCluster {
  items: MarkerItem[];
  point: [number, number];
  node: SVGGElement | undefined;
}

/** Own cluster caching, mounted marker nodes, and cancellable cluster listeners. */
export function createClusterRenderer(
  svg: SVGSVGElement,
  markerLayer: SVGGElement,
  clusterLayer: SVGGElement,
  markerNavigation: ReturnType<typeof createMarkerNavigation>,
  materializeMarker: (item: MarkerItem) => MarkerItem & { visual: MarkerVisual },
  onActivate: (items: MarkerItem[], node: SVGGElement, signal: AbortSignal) => void,
) {
  let clusterSignature = '';
  let clusterEvents = new AbortController();
  let clusterCache:
    | {
        unit: number;
        revision: number;
        focused: string | undefined;
        clusters: MarkerCluster[];
        singles: MarkerItem[];
      }
    | undefined;
  let renderedMarkers: (MarkerItem & { visual: MarkerVisual })[] = [];
  let renderedClusters: MarkerCluster[] = [];
  function invalidate() {
    clusterEvents.abort();
    clusterEvents = new AbortController();
    clusterSignature = '';
    clusterCache = undefined;
    if (clusterLayer.contains(document.activeElement)) svg.focus({ preventScroll: true });
    clusterLayer.replaceChildren();
  }
  function draw(state: ClusterState) {
    const {
      unit,
      view,
      items: markerItems,
      revision: markerRevision,
      selected: selectedMarker,
      features,
      markerColor,
      markerRadius,
      markerHitSize,
    } = state;
    const active = document.activeElement;
    const hadClusterFocus = clusterLayer.contains(active);
    const focused = active instanceof SVGElement ? active.dataset.markerId : undefined;
    if (
      !clusterCache ||
      clusterCache.unit !== unit ||
      clusterCache.revision !== markerRevision ||
      clusterCache.focused !== focused
    ) {
      const groups = features.clustering
        ? clusterPoints(
            markerItems.filter(
              (item) => item.marker.id !== selectedMarker && item.visual?.node !== active,
            ),
            unit,
            features.clustering.radius,
          ).filter((group) => group.length > 1)
        : [];
      const signature = JSON.stringify(groups.map((group) => group.map((item) => item.marker.id)));
      const previous = clusterCache?.clusters;
      const unchanged = signature === clusterSignature;
      if (!unchanged) {
        clusterEvents.abort();
        clusterEvents = new AbortController();
        if (hadClusterFocus) svg.focus({ preventScroll: true });
        clusterLayer.replaceChildren();
        clusterSignature = signature;
      }
      const grouped = new Set(groups.flat());
      clusterCache = {
        unit,
        revision: markerRevision,
        focused,
        singles: markerItems.filter((item) => !grouped.has(item)),
        clusters: groups.map((items, index) => ({
          items,
          point: [
            items.reduce((sum, item) => sum + item.point[0], 0) / items.length,
            items.reduce((sum, item) => sum + item.point[1], 0) / items.length,
          ],
          node: unchanged ? previous?.[index]?.node : undefined,
        })),
      };
    }
    const intersects = (point: [number, number], pixels: number) => {
      const padding = pixels * unit;
      return (
        point[0] >= view[0] - padding &&
        point[0] <= view[0] + view[2] + padding &&
        point[1] >= view[1] - padding &&
        point[1] <= view[1] + view[2] + padding
      );
    };
    renderedMarkers = clusterCache.singles
      .filter(
        (item) =>
          item.visual?.node === active ||
          item.marker.id === selectedMarker ||
          intersects(
            item.point,
            Math.max(markerHitSize / 2, (item.marker.radius ?? markerRadius) + 6),
          ),
      )
      .map(materializeMarker);
    const mounted = new Set(renderedMarkers.map((item) => item.visual.node));
    for (const node of Array.from(markerLayer.children))
      if (!mounted.has(node as SVGGElement)) node.remove();
    // Retain input order and stable nodes, with the selected pin above its peers.
    renderedMarkers.sort(
      (a, b) => Number(a.marker.id === selectedMarker) - Number(b.marker.id === selectedMarker),
    );
    renderedMarkers.forEach((item, index) => {
      setAttributeIfChanged(
        item.visual.dot,
        'r',
        ((item.marker.radius ?? markerRadius) + (item.marker.id === selectedMarker ? 2 : 0)) * unit,
      );
      setAttributeIfChanged(
        item.visual.hit,
        'r',
        Math.max(markerHitSize / 2, (item.marker.radius ?? markerRadius) + 4) * unit,
      );
      setAttributeIfChanged(
        item.visual.ring,
        'r',
        ((item.marker.radius ?? markerRadius) +
          2 +
          (features.selectedMarkerRing ? features.selectedMarkerRing.gap : 3)) *
          unit,
      );
      if (markerLayer.children[index] !== item.visual.node)
        markerLayer.insertBefore(item.visual.node, markerLayer.children[index] ?? null);
    });
    if (active instanceof SVGGElement && mounted.has(active) && document.activeElement !== active)
      active.focus({ preventScroll: true });
    renderedClusters = clusterCache.clusters.filter(
      (cluster) => cluster.node === active || intersects(cluster.point, 26),
    );
    const visibleClusters = new Set(renderedClusters);
    for (const cluster of clusterCache.clusters)
      if (!visibleClusters.has(cluster)) cluster.node?.remove();
    for (const cluster of renderedClusters) {
      const group = cluster.items;
      if (!cluster.node) {
        const signal = clusterEvents.signal;
        const node = svgElement('g', {
          role: 'button',
          tabindex: -1,
          'data-cluster-ids': JSON.stringify(group.map((item) => item.marker.id)),
          'aria-label': `${group.length} places. Activate to explore or choose a place.`,
        });
        node.style.cursor = 'pointer';
        node.append(
          svgElement('circle', {
            fill: markerColor,
            stroke: '#fff',
            'stroke-width': 2,
            'vector-effect': 'non-scaling-stroke',
          }),
        );
        const text = svgElement('text', {
          fill: '#fff',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
        });
        text.textContent = String(group.length);
        node.append(text);
        const activate = () => {
          if (!signal.aborted) onActivate(group, node, signal);
        };
        node.addEventListener('click', activate, { signal });
        node.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate();
            }
          },
          { signal },
        );
        cluster.node = node;
      }
      const node = cluster.node;
      if (node.parentNode !== clusterLayer) clusterLayer.append(node);
      setAttributeIfChanged(
        node,
        'transform',
        `translate(${cluster.point[0]},${cluster.point[1]})`,
      );
      const circle = node.querySelector('circle');
      const text = node.querySelector('text');
      if (circle) setAttributeIfChanged(circle, 'r', 22 * unit);
      if (text) setAttributeIfChanged(text, 'font-size', 12 * unit);
    }
    markerNavigation.sync([
      ...renderedMarkers.map((item) => item.visual.node),
      ...(Array.from(clusterLayer.children) as SVGElement[]),
    ]);
    if (hadClusterFocus && document.activeElement === svg) markerNavigation.recover();
    return { markers: renderedMarkers, clusters: renderedClusters };
  }
  return {
    draw,
    invalidate,
    destroy() {
      clusterEvents.abort();
      clusterCache = undefined;
      renderedMarkers = [];
      renderedClusters = [];
    },
  };
}
