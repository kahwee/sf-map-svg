import type { InteractiveSFMapData } from '../explorer-data.js';
import type { createLayerTransitions } from '../layer-transition.js';
import type { createNeighborhoodLayer } from '../neighborhood-layer.js';
import type { DistrictYear, InteractiveLayers, NeighborhoodExplorerOptions } from '../types.js';

type LayerCompositionHost = {
  svg: SVGSVGElement;
  stations: SVGGElement;
  legend: HTMLElement;
  areas: SVGGElement;
  neighborhoodLabel: HTMLElement;
  attribution: HTMLElement;
  districtLayers: SVGGElement[];
  neighborhoods: Pick<ReturnType<typeof createNeighborhoodLayer>, 'items' | 'selected' | 'source'>;
  collections: InteractiveSFMapData['neighborhoods'];
  layerFades: ReturnType<typeof createLayerTransitions>;
  enabled(key: keyof InteractiveLayers): boolean;
  labels: boolean;
  year: DistrictYear;
  chrome: 'map' | 'explorer';
  controls: NonNullable<NeighborhoodExplorerOptions['controls']>;
  selectableNeighborhoods: boolean;
  syncFeatureControls(): void;
  updateDistrictAppearance(): void;
  scheduleLabels(): void;
};

/** Synchronize layer visibility, focusability, legend and geographic descriptions. */
export function renderLayerComposition(host: LayerCompositionHost) {
  const {
    svg,
    stations,
    legend,
    areas,
    neighborhoodLabel,
    attribution,
    districtLayers,
    neighborhoods,
    collections,
    layerFades,
    enabled,
    labels,
    year,
    chrome,
    controls,
    selectableNeighborhoods,
    syncFeatureControls,
    updateDistrictAppearance,
    scheduleLabels,
  } = host;
  for (const [name, key] of [
    ['landmarks', 'landmarks'],
    ['highways', 'highways'],
    ['key-roads', 'keyRoads'],
  ] as const) {
    const layer = svg.querySelector<SVGElement>(`[data-layer="${name}"]`);
    if (layer) layerFades.set(layer, enabled(key));
  }
  layerFades.set(stations, enabled('bartStations'));
  for (const [kind, key] of [
    ['bart', 'bartStations'],
    ['park', 'landmarks'],
    ['road', 'keyRoads'],
    ['highway', 'highways'],
  ] as const) {
    const entry = legend.querySelector<HTMLElement>(`.sf-explorer-legend-${kind}`)?.parentElement;
    if (entry) entry.hidden = !enabled(key);
  }
  legend.hidden =
    controls.legend === false ||
    ![...legend.children].some((node) => !(node as HTMLElement).hidden);

  const neighborhoodsVisible =
    enabled('neighborhoodLines') || (labels && enabled('neighborhoodLabels'));
  layerFades.set(areas, neighborhoodsVisible);
  areas.style.pointerEvents = selectableNeighborhoods ? '' : 'none';
  neighborhoodLabel.hidden =
    !neighborhoodsVisible ||
    !selectableNeighborhoods ||
    chrome === 'explorer' ||
    controls.neighborhoodPicker === false;
  syncFeatureControls();
  for (const item of neighborhoods.items) {
    item.node.setAttribute(
      'stroke-width',
      item.feature === neighborhoods.selected ? '2.2' : enabled('neighborhoodLines') ? '.55' : '0',
    );
    item.node.setAttribute(
      'tabindex',
      selectableNeighborhoods && item === neighborhoods.items[0] ? '0' : '-1',
    );
    item.node.setAttribute('role', selectableNeighborhoods ? 'button' : 'img');
    if (!selectableNeighborhoods) item.node.removeAttribute('aria-pressed');
  }
  for (const layer of districtLayers) {
    const key = layer.dataset.layer === 'district-fills' ? 'districtFills' : 'districtLines';
    layerFades.set(layer, enabled(key));
  }
  updateDistrictAppearance();
  const districtsVisible =
    enabled('districtFills') || enabled('districtLines') || (labels && enabled('districtLabels'));
  const descriptions = ['San Francisco map.'];
  if (districtsVisible) descriptions.push(`${year} supervisorial districts, DataSF.`);
  if (neighborhoodsVisible) {
    const collection = collections[neighborhoods.source];
    if (collection) descriptions.push(`${collection.title}. ${collection.definition.description}`);
  }
  if (enabled('landmarks')) descriptions.push('Park property boundaries from DataSF.');
  if (enabled('highways') || enabled('keyRoads')) descriptions.push('Road geometry from DataSF.');
  if (enabled('bartStations')) descriptions.push('BART station locations from BART.');
  descriptions.push('Display coastline from DataSF. Source downloads: September 2026.');
  const description = descriptions.join(' ');
  const desc = svg.querySelector('desc');
  if (desc) desc.textContent = description;
  const title = svg.querySelector('title');
  if (title) title.textContent = 'San Francisco map';
  svg.setAttribute(
    'aria-label',
    `${description} Arrow keys pan; plus and minus zoom; Home resets. Districts, neighborhoods, markers and clusters: brackets move focus; Enter selects. Coincident pins open a place chooser. The neighborhood and marker menus include every supplied item.`,
  );
  attribution.textContent = description;
  scheduleLabels();
}
