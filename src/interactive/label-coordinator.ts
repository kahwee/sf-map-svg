import type { Bounds } from '../../data/types.js';
import type { View } from '../explorer-layout.js';
import type { normalizeFeatures } from '../features.js';
import {
  type LabelItem,
  labelCandidates,
  type RenderLabel,
  styleLabels,
} from '../label-candidates.js';
import type { ExplorerMode, InteractiveLayers, NeighborhoodExplorerOptions } from '../types.js';
import { setAttributeIfChanged } from './dom.js';
import { createLabelRenderer } from './label-renderer.js';
import type { createMarkerCatalog } from './marker-catalog.js';
import type { createMarkerController } from './marker-controller.js';
import type { MarkerItem, MarkerVisual } from './marker-renderer.js';
import type { createNeighborhoodLayer } from './neighborhood-layer.js';

interface LabelHost {
  root: HTMLElement;
  canvas: HTMLElement;
  scale: HTMLElement;
  overlayElement: HTMLElement;
  secondaryRoads: NodeListOf<SVGPathElement>;
  stationItems: (LabelItem & { node: SVGCircleElement })[];
  roadItems: LabelItem[];
  parkItems: LabelItem[];
  scaleUnitsPerMeter: number;
  neighborhoods: ReturnType<typeof createNeighborhoodLayer>;
  markerCatalog: ReturnType<typeof createMarkerCatalog>;
  markers: ReturnType<typeof createMarkerController>;
  labelLayer: SVGGElement;
  invalidateFrame(): void;
  get districtItems(): LabelItem[];
  get layers(): InteractiveLayers;
  get mode(): ExplorerMode;
  get labelStyle(): NonNullable<NeighborhoodExplorerOptions['labelStyle']>;
  get colors(): NonNullable<NeighborhoodExplorerOptions['colors']>;
  get minLabelSize(): number;
  get maxLabelSize(): number;
  get markerRadius(): number;
  get view(): View;
  get destroyed(): boolean;
  get labels(): boolean;
  get features(): ReturnType<typeof normalizeFeatures>;
  get renderedMarkers(): (MarkerItem & { visual: MarkerVisual })[];
  get renderedClusters(): { point: [number, number] }[];
  enabled(layer: keyof InteractiveLayers): boolean;
  drawClusters(unit: number): void;
}

/** Own candidate caching, screen-space collision layout and label metrics invalidation. */
export function createLabelCoordinator(host: LabelHost) {
  const {
    root,
    canvas,
    scale,
    overlayElement,
    secondaryRoads,
    stationItems,
    roadItems,
    parkItems,
    scaleUnitsPerMeter,
    neighborhoods,
    markerCatalog,
    markers,
    enabled,
    drawClusters,
  } = host;
  const labelRenderer = createLabelRenderer(host.labelLayer);
  let secondaryRoadsVisible: boolean | undefined;
  let labelInputs: readonly unknown[] = [];
  let preparedLabels: RenderLabel[] = [];
  function prepareLabels(width: number, zoom: number) {
    // Only screen-space positioning changes during pan or within these zoom/width bands.
    const inputs = [
      neighborhoods.items,
      neighborhoods.selected,
      host.districtItems,
      markers.revision,
      host.layers,
      host.mode,
      host.labelStyle,
      host.colors,
      host.minLabelSize,
      host.maxLabelSize,
      host.markerRadius,
      zoom >= 1.8,
      width >= 550,
    ];
    if (inputs.every((value, index) => value === labelInputs[index])) return preparedLabels;
    labelInputs = inputs;
    const selectedItem = neighborhoods.items.find(
      (item) => item.feature === neighborhoods.selected,
    );
    const candidates: LabelItem[] = [];
    const marker = markerCatalog.items.find((item) => item.marker.id === markers.selected);
    if (marker)
      candidates.push({
        point: marker.point,
        name: marker.marker.label ?? marker.marker.id,
        kind: 'selected-marker',
      });
    if (selectedItem?.point && enabled('neighborhoodLabels'))
      candidates.push({
        point: selectedItem.point,
        name: selectedItem.feature.properties.canonicalName,
        kind: 'selected',
      });
    preparedLabels = styleLabels(
      labelCandidates(
        {
          selected: candidates,
          districts: enabled('districtLabels') ? host.districtItems : [],
          stations: enabled('bartStations') ? stationItems : [],
          parks: enabled('landmarks') ? parkItems : [],
          roads: enabled('roadLabels') ? roadItems : [],
          neighborhoods: enabled('neighborhoodLabels')
            ? neighborhoods.items
                .filter((item) => item.point !== undefined)
                .sort((a, b) => b.area - a.area || a.feature.id.localeCompare(b.feature.id))
                .flatMap((item) =>
                  item.feature !== neighborhoods.selected && item.point
                    ? [
                        {
                          point: item.point,
                          name: item.feature.properties.canonicalName,
                          kind: 'neighborhood',
                        },
                      ]
                    : [],
                )
            : [],
        },
        width,
        zoom,
      ),
      {
        colors: host.colors,
        labelStyle: host.labelStyle,
        labelSize: { min: host.minLabelSize, max: host.maxLabelSize },
        markerRadius: marker?.marker.radius ?? host.markerRadius,
      },
    );
    return preparedLabels;
  }
  function drawLabels() {
    if (host.destroyed) return;
    const canvasBox = canvas.getBoundingClientRect();
    const width = canvasBox.width;
    if (!width) return;
    const unit = host.view[2] / width,
      zoom = 800 / host.view[2];
    if (host.features.scaleBar) {
      const pixelsPerMeter = scaleUnitsPerMeter / unit;
      const base = 10 ** Math.floor(Math.log10(100 / pixelsPerMeter));
      const meters =
        [5, 2, 1].map((factor) => factor * base).find((value) => value * pixelsPerMeter <= 100) ??
        base;
      const scaleWidth = `${meters * pixelsPerMeter}px`;
      const scaleText = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
      if (scale.style.width !== scaleWidth) scale.style.width = scaleWidth;
      if (scale.textContent !== scaleText) scale.textContent = scaleText;
    }
    // Read overlay bounds before SVG writes; scale furniture above must have its current width.
    const furnitureBounds: Bounds[] = [...overlayElement.children]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const box = node.getBoundingClientRect();
        return [
          box.left - canvasBox.left - 3,
          box.top - canvasBox.top - 3,
          box.right - canvasBox.left + 3,
          box.bottom - canvasBox.top + 3,
        ];
      });
    const showSecondaryRoads = zoom >= 1.8;
    if (showSecondaryRoads !== secondaryRoadsVisible) {
      for (const road of secondaryRoads) road.style.display = showSecondaryRoads ? '' : 'none';
      secondaryRoadsVisible = showSecondaryRoads;
    }
    for (const station of stationItems) setAttributeIfChanged(station.node, 'r', 4.5 * unit);
    drawClusters(unit);
    if (!host.labels) {
      labelRenderer.clear();
      root.dataset.visibleLabels = '0';
      return;
    }
    const labelCandidates = prepareLabels(width, zoom);
    const stationBounds: Bounds[] = (enabled('bartStations') ? stationItems : []).map(
      ({ point }) => {
        const x = (point[0] - host.view[0]) / unit;
        const y = (point[1] - host.view[1]) / unit;
        return [x - 6, y - 6, x + 6, y + 6];
      },
    );
    const markerBounds: Bounds[] = host.renderedMarkers.map(({ point, marker }) => {
      const radius = marker.radius ?? host.markerRadius;
      const x = (point[0] - host.view[0]) / unit,
        y = (point[1] - host.view[1]) / unit;
      return [x - radius - 3, y - radius - 3, x + radius + 3, y + radius + 3];
    });
    root.dataset.visibleLabels = String(
      labelRenderer.draw(labelCandidates, host.view, width, [
        ...stationBounds,
        ...markerBounds,
        ...furnitureBounds,
        ...host.renderedClusters.map(({ point }): Bounds => {
          const x = (point[0] - host.view[0]) / unit,
            y = (point[1] - host.view[1]) / unit;
          return [x - 26, y - 26, x + 26, y + 26];
        }),
      ]),
    );
  }
  return {
    draw: drawLabels,
    schedule() {
      if (!host.destroyed) host.invalidateFrame();
    },
    invalidateMetrics() {
      labelRenderer.invalidateMetrics();
      labelInputs = [];
    },
    clear() {
      labelRenderer.clear();
      labelInputs = [];
      preparedLabels = [];
    },
  };
}
