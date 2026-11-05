import type { MapAppearance } from '../controller-types.js';
import type { normalizeFeatures } from '../features.js';
import { resolveMapColors } from '../rendering/svg-map-renderer.js';
import type { MarkerItem } from './marker-renderer.js';
import type { createNeighborhoodLayer } from './neighborhood-layer.js';

type AppearanceView = {
  root: HTMLElement;
  svg: SVGSVGElement;
  labelLayer: SVGGElement;
  legend: HTMLElement;
  stationItems: readonly { node: SVGCircleElement }[];
  neighborhoods: Pick<ReturnType<typeof createNeighborhoodLayer>, 'items' | 'selected'>;
  markerItems: readonly MarkerItem[];
  selectedMarker: string | null;
  invalidateLabelMetrics(): void;
};
type AppearanceState = Pick<
  Required<MapAppearance>,
  'theme' | 'colors' | 'labelStyle' | 'areaStyle' | 'style' | 'markerColor' | 'selectedMarkerColor'
> & { selectedMarkerRing: ReturnType<typeof normalizeFeatures>['selectedMarkerRing'] };

/** Paint committed appearance without changing selection, camera or transaction state. */
export function renderMapAppearance(view: AppearanceView, appearance: AppearanceState) {
  const {
    root,
    svg,
    labelLayer,
    legend,
    stationItems,
    neighborhoods,
    markerItems,
    selectedMarker,
  } = view;
  const {
    theme,
    colors,
    labelStyle,
    areaStyle,
    style: styleOptions,
    markerColor,
    selectedMarkerColor,
    selectedMarkerRing,
  } = appearance;
  const palette = resolveMapColors(theme, colors);
  svg.querySelector('rect')?.setAttribute('fill', palette.water);
  svg.querySelector('[data-layer="coast"]')?.setAttribute('fill', palette.land);
  svg.querySelector('[data-layer="coastline"]')?.setAttribute('stroke', palette.district);
  for (const [layer, color] of [
    ['landmarks', palette.park],
    ['highways', palette.highway],
    ['key-roads', palette.road],
  ] as const)
    for (const node of svg.querySelectorAll(`[data-layer="${layer}"] path`)) {
      node.setAttribute(layer === 'landmarks' ? 'fill' : 'stroke', color);
      if (layer === 'highways')
        node.setAttribute('stroke-width', theme === 'transit' ? '2' : '1.4');
    }
  for (const [token, fallback, name] of [
    ['ink', '#18364f', 'ink'],
    ['surface', '#fff', 'surface'],
    ['accent', '#163d61', 'accent'],
    ['border', '#cedae3', 'border'],
    ['focus', '#1676b8', 'focus'],
    ['controlGap', '6px', 'control-gap'],
    ['font', 'system-ui,sans-serif', 'font'],
  ] as const)
    root.style.setProperty(`--sf-map-${name}`, styleOptions[token] ?? fallback);
  labelLayer.setAttribute(
    'font-family',
    labelStyle.fontFamily ?? styleOptions.font ?? 'system-ui,sans-serif',
  );
  view.invalidateLabelMetrics();
  for (const station of stationItems) station.node.setAttribute('stroke', colors.bart ?? '#0073ae');
  for (const kind of ['bart', 'park', 'highway', 'road'] as const) {
    const symbol = legend.querySelector<HTMLElement>(`.sf-explorer-legend-${kind}`);
    if (symbol) {
      symbol.style.removeProperty(kind === 'bart' ? 'border-color' : 'background-color');
      if (colors[kind])
        symbol.style.setProperty(
          kind === 'bart' ? 'border-color' : 'background-color',
          colors[kind],
        );
    }
  }
  for (const item of neighborhoods.items) {
    const active = item.feature === neighborhoods.selected;
    item.node.setAttribute('fill', active ? (areaStyle.selectedFill ?? '#408dbe') : 'transparent');
    item.node.setAttribute(
      'stroke',
      active ? (areaStyle.selectedStroke ?? '#176ba2') : (colors.neighborhood ?? '#9caebc'),
    );
  }
  for (const item of markerItems) {
    const visual = item.visual;
    if (!visual) continue;
    visual.dot.setAttribute(
      'fill',
      item.marker.id === selectedMarker ? selectedMarkerColor : (item.marker.color ?? markerColor),
    );
    visual.ring.setAttribute(
      'stroke',
      selectedMarkerRing ? (selectedMarkerRing.color ?? selectedMarkerColor) : selectedMarkerColor,
    );
  }
}
