import type { Geometry, Position } from '../../data/types.js';
import type { View } from '../explorer-layout.js';
import type { normalizeFeatures } from '../features.js';
import { createClusterLayer } from './cluster-layer.js';
import { clusterPoints } from './clusters.js';
import { svgElement } from './dom.js';
import type { createMarkerCatalog } from './marker-catalog.js';
import { createMarkerChooser } from './marker-chooser.js';
import type { createMarkerController } from './marker-controller.js';
import type { createMarkerNavigation } from './marker-navigation.js';
import type { MarkerItem, MarkerVisual } from './marker-renderer.js';

interface ClusterHost {
  root: HTMLElement;
  canvas: HTMLElement;
  svg: SVGSVGElement;
  geography: Element;
  markerLayer: SVGGElement;
  markerCatalog: ReturnType<typeof createMarkerCatalog>;
  markerNavigation: ReturnType<typeof createMarkerNavigation>;
  markers: ReturnType<typeof createMarkerController>;
  materializeMarker(item: MarkerItem): MarkerItem & { visual: MarkerVisual };
  fitGeometry(geometry: Geometry): void;
  readonly destroyed: boolean;
  readonly features: ReturnType<typeof normalizeFeatures>;
  readonly view: View;
  readonly markerColor: string;
  readonly markerRadius: number;
  readonly markerHitSize: number;
}

/** Own cluster activation, overlap choice and the currently mounted marker set. */
export function createMarkerClusters(host: ClusterHost) {
  const {
    root,
    canvas,
    svg,
    geography,
    markerLayer,
    markerCatalog,
    markerNavigation,
    markers,
    materializeMarker,
    fitGeometry,
  } = host;
  const { selectMarker } = markers;
  const markerChooser = createMarkerChooser(canvas, svg, (id) => {
    if (host.destroyed) return;
    selectMarker(id);
    if (!host.destroyed && markers.selected === id)
      markerCatalog.items
        .find((item) => item.marker.id === id)
        ?.visual?.node.focus({ preventScroll: true });
  });
  const clusterLayer = svgElement('g', { 'data-layer': 'marker-clusters' });
  geography.insertBefore(clusterLayer, markerLayer);
  const clusters = createClusterLayer(
    svg,
    markerLayer,
    clusterLayer,
    markerNavigation,
    materializeMarker,
    (group, node, signal) => {
      if (host.destroyed || signal.aborted) return;
      const markers = group.map((item) => ({
        ...item.marker,
        position: [...item.marker.position] as Position,
      }));
      const minimumUnit = 800 / 12 / Math.max(1, canvas.getBoundingClientRect().width);
      if (
        clusterPoints(
          group,
          minimumUnit,
          host.features.clustering ? host.features.clustering.radius : 36,
        ).length === 1
      )
        markerChooser.open(markers, node);
      else
        fitGeometry({
          type: 'MultiPoint',
          coordinates: markers.map((marker) => marker.position),
        });
      if (!host.destroyed && !signal.aborted)
        root.dispatchEvent(
          new CustomEvent('clusteractivate', { bubbles: true, detail: { markers } }),
        );
    },
  );
  let renderedMarkers: (MarkerItem & { visual: MarkerVisual })[] = [];
  let renderedClusters: { point: [number, number] }[] = [];
  function invalidateClusters() {
    markerChooser.close();
    clusters.invalidate();
  }
  function drawClusters(unit: number) {
    const rendered = clusters.draw({
      unit,
      view: host.view,
      items: markerCatalog.items,
      revision: markers.revision,
      selected: markers.selected,
      features: host.features,
      markerColor: host.markerColor,
      markerRadius: host.markerRadius,
      markerHitSize: host.markerHitSize,
    });
    renderedMarkers = rendered.markers;
    renderedClusters = rendered.clusters;
  }
  return {
    chooser: markerChooser,
    invalidate: invalidateClusters,
    draw: drawClusters,
    destroy: clusters.destroy,
    get renderedMarkers() {
      return renderedMarkers;
    },
    get renderedClusters() {
      return renderedClusters;
    },
  };
}
