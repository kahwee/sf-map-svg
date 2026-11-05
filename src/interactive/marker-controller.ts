import type { Position } from '../../data/types.js';
import { fitBounds, type View } from '../explorer-layout.js';
import type { normalizeFeatures } from '../features.js';
import type { CameraOptions, MapMarker, NeighborhoodExplorerOptions } from '../types.js';
import { fitViewport } from '../viewport.js';
import { validateCameraOptions } from './camera.js';
import type { createMarkerCatalog } from './marker-catalog.js';
import type { createMarkerChooser } from './marker-chooser.js';
import type { createMarkerNavigation } from './marker-navigation.js';
import type { MarkerItem, MarkerVisual } from './marker-renderer.js';

interface MarkerHost {
  root: HTMLElement;
  canvas: HTMLElement;
  svg: SVGSVGElement;
  markerLayer: SVGGElement;
  markerSelect: HTMLSelectElement;
  markerLabel: HTMLElement;
  markerCatalog: ReturnType<typeof createMarkerCatalog>;
  markerNavigation: ReturnType<typeof createMarkerNavigation>;
  get markerChooser(): ReturnType<typeof createMarkerChooser>;
  get destroyed(): boolean;
  get view(): View;
  get features(): ReturnType<typeof normalizeFeatures>;
  get markerColor(): string;
  get selectedMarkerColor(): string;
  get controls(): NonNullable<NeighborhoodExplorerOptions['controls']>;
  strings: NonNullable<NeighborhoodExplorerOptions['strings']>;
  fitPadding: NonNullable<NeighborhoodExplorerOptions['fitPadding']>;
  onMarkerActivate: NeighborhoodExplorerOptions['onMarkerActivate'];
  invalidateClusters(): void;
  drawClusters(unit: number): void;
  materializeMarker(item: MarkerItem): MarkerItem & { visual: MarkerVisual };
  scheduleLabels(): void;
  syncFeatureControls(): void;
  moveView(view: View, options?: CameraOptions): void;
}

/** Own selection revisions, activation and focus recovery independently of marker rendering. */
export function createMarkerController(host: MarkerHost) {
  const {
    root,
    canvas,
    svg,
    markerLayer,
    markerSelect,
    markerLabel,
    markerCatalog,
    markerNavigation,
    strings,
    fitPadding,
    onMarkerActivate,
    invalidateClusters,
    drawClusters,
    materializeMarker,
    scheduleLabels,
    syncFeatureControls,
    moveView,
  } = host;
  let selectedMarker: string | null = null;
  let markerRevision = 0;
  function getSelectedMarker() {
    const marker = markerCatalog.items.find((item) => item.marker.id === selectedMarker)?.marker;
    return marker ? { ...marker, position: [...marker.position] as Position } : null;
  }
  function selectMarker(id: string | null, options: { fit?: boolean } & CameraOptions = {}) {
    if (host.destroyed) return false;
    const item = markerCatalog.items.find((item) => item.marker.id === id);
    if (id !== null && !item) return false;
    validateCameraOptions(options);
    const width = canvas.getBoundingClientRect().width;
    const target =
      item && options.fit !== false
        ? width
          ? fitViewport([...item.point, ...item.point], width, fitPadding)
          : fitBounds([...item.point, ...item.point])
        : null;
    const revision = ++markerRevision;
    const changed = selectedMarker !== id;
    selectedMarker = id;
    if (changed) invalidateClusters();
    markerSelect.value = id ?? '';
    for (const entry of markerCatalog.items) {
      const active = entry.marker.id === id;
      const visual = active ? materializeMarker(entry).visual : entry.visual;
      if (!visual) continue;
      const pressed = String(active);
      const ring = active && host.features.selectedMarkerRing ? 'inline' : 'none';
      const fill = active ? host.selectedMarkerColor : (entry.marker.color ?? host.markerColor);
      if (visual.node.getAttribute('aria-pressed') !== pressed)
        visual.node.setAttribute('aria-pressed', pressed);
      if (visual.ring.getAttribute('display') !== ring) visual.ring.setAttribute('display', ring);
      if (visual.dot.getAttribute('fill') !== fill) visual.dot.setAttribute('fill', fill);
      if (active && markerLayer.lastChild !== visual.node) markerLayer.append(visual.node);
    }
    scheduleLabels();
    if (width || !host.features.clustering) drawClusters(width ? host.view[2] / width : 1);
    const marker = getSelectedMarker();
    if (changed)
      root.dispatchEvent(
        new CustomEvent('markerchange', { bubbles: true, detail: { id, marker } }),
      );
    if (
      !host.destroyed &&
      changed &&
      marker &&
      markerRevision === revision &&
      selectedMarker === id
    )
      onMarkerActivate?.({ ...marker });
    if (!host.destroyed && markerRevision === revision && target) moveView(target, options);
    return true;
  }
  function setMarkers(markers: readonly MapMarker[]) {
    if (host.destroyed) return;
    const prepared = markerCatalog.prepare(markers, selectedMarker);
    if (!prepared) return;
    const { selection: nextSelection, focused: focusedMarker } = prepared;
    invalidateClusters();
    prepared.commit();
    markerLabel.hidden = !markerCatalog.items.length || host.controls.markerPicker === false;
    if (markerLabel.firstChild)
      markerLabel.firstChild.textContent = `${strings.chooseMarker ?? 'Choose marker'} (${markerCatalog.items.length})`;
    syncFeatureControls();
    const revision = markerRevision + 1;
    selectMarker(nextSelection, { fit: false });
    if (!host.destroyed && markerRevision === revision && focusedMarker) {
      markerNavigation.sync(
        markerCatalog.items.flatMap((item) => (item.visual ? [item.visual.node] : [])),
      );
      if (!markerNavigation.recover()) {
        const recovery =
          markerCatalog.items.find((item) => item.marker.id === focusedMarker) ??
          markerCatalog.items[0];
        if (recovery) {
          const { node } = materializeMarker(recovery).visual;
          markerLayer.append(node);
          node.focus({ preventScroll: true });
          const width = canvas.getBoundingClientRect().width;
          if (width) drawClusters(host.view[2] / width);
        } else svg.focus({ preventScroll: true });
      }
    }
  }
  function activateMarker(id: string, node: SVGElement) {
    const item = markerCatalog.items.find((item) => item.marker.id === id);
    if (!item) return;
    const coincident = markerCatalog.items.filter(
      (other) => other.point[0] === item.point[0] && other.point[1] === item.point[1],
    );
    if (coincident.length > 1)
      host.markerChooser.open(
        coincident.map((other) => other.marker),
        node,
      );
    else {
      selectMarker(id);
      if (!host.destroyed && selectedMarker === id)
        markerCatalog.items
          .find((other) => other.marker.id === id)
          ?.visual?.node.focus({ preventScroll: true });
    }
  }
  return {
    getSelectedMarker,
    selectMarker,
    setMarkers,
    activateMarker,
    get selected() {
      return selectedMarker;
    },
    get revision() {
      return markerRevision;
    },
  };
}
