import type { Bounds, NeighborhoodFeature, NeighborhoodSource } from '../data/types.js';
import { validateCameraOptions } from './camera.js';
import { element, svgElement } from './dom.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import { fitBounds, interiorAnchor, projectedBounds } from './explorer-layout.js';
import { geometryPath, type Project } from './geometry.js';
import type {
  CameraOptions,
  DistrictYear,
  ExplorerMode,
  MapPadding,
  MapViewport,
  NeighborhoodExplorerOptions,
  NeighborhoodSelection,
} from './types.js';
import { fitViewport } from './viewport.js';

export interface NeighborhoodItem {
  feature: NeighborhoodFeature;
  node: SVGPathElement;
  bounds: Bounds;
  point: [number, number] | undefined;
  area: number;
}
export const sourceNames: Record<NeighborhoodSource, string> = {
  realtor: 'SFAR realtor · 92 areas',
  'sf-find': 'SF Find · 117 areas',
  analysis: 'City analysis · 41 areas',
};
const normalizeName = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const formatSourceLabel = (source: NeighborhoodSource) =>
  sourceNames[source] ?? `${source} neighborhoods`;

/** Source-scoped names and aliases; same-name polygons never cross source boundaries. */
export function createNeighborhoodLookup(collections: InteractiveSFMapData['neighborhoods']) {
  const getNeighborhood = (name: string, selectedSource: NeighborhoodSource) => {
    const term = normalizeName(name);
    if (!term) return undefined;
    return collections[selectedSource]?.features.find((feature) =>
      [
        feature.id,
        feature.properties.canonicalName,
        feature.properties.sourceName,
        ...feature.properties.aliases,
      ].some((value) => normalizeName(value) === term),
    );
  };
  const searchNeighborhoods = (query: string, selectedSource: NeighborhoodSource) => {
    const term = normalizeName(query);
    return (collections[selectedSource]?.features ?? [])
      .filter((feature) =>
        [
          feature.id,
          feature.properties.canonicalName,
          feature.properties.sourceName,
          ...feature.properties.aliases,
        ].some((value) => normalizeName(value).includes(term)),
      )
      .map((feature) => ({ id: feature.id, canonicalName: feature.properties.canonicalName }));
  };
  return { getNeighborhood, searchNeighborhoods };
}

interface NeighborhoodPresentation {
  mode: ExplorerMode;
  year: DistrictYear;
  fitPadding: number | MapPadding;
  areaStyle: NonNullable<NeighborhoodExplorerOptions['areaStyle']>;
  colors: NonNullable<NeighborhoodExplorerOptions['colors']>;
  selectableNeighborhoods: boolean;
  lines: boolean;
}

interface NeighborhoodLayerOptions {
  collections: InteractiveSFMapData['neighborhoods'];
  initialSource: NeighborhoodSource;
  project: Project;
  root: HTMLElement;
  areas: SVGGElement;
  canvas: HTMLElement;
  sourceSelect: HTMLSelectElement;
  neighborhoodSelect: HTMLSelectElement;
  status: HTMLElement;
  readPresentation(): NeighborhoodPresentation;
  isDestroyed(): boolean;
  ensureVisible(): void;
  refresh: { selection(): void; source(): void };
  moveView(view: MapViewport, options: CameraOptions): void;
  resetView(): void;
  crossfade(layer: SVGGElement, commit: () => void): void;
}

/** Own neighborhood identity, prepared geometry, selection revisions and hover listeners.
 * Preparation is detached: only the returned commit can replace the active source.
 */
export function createNeighborhoodLayer({
  collections,
  initialSource,
  project,
  root,
  areas,
  canvas,
  sourceSelect,
  neighborhoodSelect,
  status,
  readPresentation,
  isDestroyed,
  ensureVisible,
  refresh,
  moveView,
  resetView,
  crossfade,
}: NeighborhoodLayerOptions) {
  let source = initialSource;
  let selected: NeighborhoodFeature | undefined;
  let items: NeighborhoodItem[] = [];
  let neighborhoodRevision = 0;
  let sourceEvents = new AbortController();
  const { getNeighborhood } = createNeighborhoodLookup(collections);
  function getSelection(): NeighborhoodSelection | null {
    return selected
      ? {
          id: selected.id,
          name: selected.properties.canonicalName,
          source,
          feature: structuredClone(selected),
        }
      : null;
  }
  function selectNeighborhood(
    name: string | null,
    options: { fit?: boolean } & CameraOptions = {},
  ) {
    if (isDestroyed()) return false;
    const feature =
      name === null
        ? undefined
        : (collections[source]?.features.find((entry) => entry.id === name) ??
          getNeighborhood(name, source));
    if (name !== null && !feature) return false;
    validateCameraOptions(options);
    const { fitPadding } = readPresentation();
    const selectedItem = items.find((item) => item.feature === feature);
    const width = canvas.getBoundingClientRect().width;
    const target =
      selectedItem && options.fit !== false
        ? width
          ? fitViewport(selectedItem.bounds, width, fitPadding)
          : fitBounds(selectedItem.bounds)
        : null;
    if (feature) ensureVisible();
    const { areaStyle, colors, selectableNeighborhoods, lines } = readPresentation();
    const revision = ++neighborhoodRevision;
    const changed = selected !== feature;
    selected = feature;
    for (const item of items) {
      const active = item.feature === selected;
      item.node.setAttribute(
        'fill',
        active ? (areaStyle.selectedFill ?? '#408dbe') : 'transparent',
      );
      item.node.setAttribute('fill-opacity', active ? '.16' : '1');
      item.node.setAttribute(
        'stroke',
        active ? (areaStyle.selectedStroke ?? '#176ba2') : (colors.neighborhood ?? '#9caebc'),
      );
      item.node.setAttribute('stroke-width', active ? '2.2' : lines ? '.55' : '0');
      if (selectableNeighborhoods) item.node.setAttribute('aria-pressed', String(active));
      if (active) areas.append(item.node);
    }
    if (feature) root.dataset.selectedNeighborhood = feature.id;
    else delete root.dataset.selectedNeighborhood;
    neighborhoodSelect.value = feature?.id ?? '';
    refresh.selection();
    status.textContent = feature
      ? `${feature.properties.canonicalName} selected. ${formatSourceLabel(source)}.`
      : 'Neighborhood selection cleared.';
    if (changed)
      root.dispatchEvent(
        new CustomEvent('neighborhoodchange', {
          bubbles: true,
          detail: {
            feature: feature ? structuredClone(feature) : null,
            source,
            id: feature?.id ?? null,
            name: feature?.properties.canonicalName ?? null,
          },
        }),
      );
    if (!isDestroyed() && neighborhoodRevision === revision && target) moveView(target, options);
    return true;
  }
  function prepareSource(next: NeighborhoodSource, reset = true) {
    const { colors } = readPresentation();
    const events = new AbortController();
    if (!Object.hasOwn(collections, next))
      throw new RangeError(`Unknown neighborhood source: ${next}`);
    const collection = collections[next];
    if (
      !collection ||
      !Array.isArray(collection.features) ||
      typeof collection.title !== 'string' ||
      typeof collection.definition?.description !== 'string'
    )
      throw new TypeError(
        'Neighborhood collections require features, title and definition description.',
      );
    const ids = new Set<string>();
    const nextOptions: HTMLOptionElement[] = [];
    const nextItems = collection.features.map((feature) => {
      if (
        !feature ||
        typeof feature.id !== 'string' ||
        !feature.id ||
        ids.has(feature.id) ||
        !feature.properties ||
        typeof feature.properties.canonicalName !== 'string' ||
        typeof feature.properties.sourceName !== 'string' ||
        !Array.isArray(feature.properties.aliases) ||
        Array.from(feature.properties.aliases).some((alias) => typeof alias !== 'string') ||
        !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)
      )
        throw new TypeError(
          'Neighborhood features require unique IDs, names, aliases and polygon geometry.',
        );
      ids.add(feature.id);
      const bounds = projectedBounds(feature.geometry, project);
      if (!bounds.every(Number.isFinite))
        throw new RangeError('Neighborhood geometry must be nonempty and finite.');
      const node = svgElement('path', {
        d: geometryPath(feature.geometry, project),
        'data-neighborhood-id': feature.id,
        fill: 'transparent',
        'fill-rule': 'evenodd',
        stroke: colors.neighborhood ?? '#9caebc',
        'stroke-width': '.55',
        'vector-effect': 'non-scaling-stroke',
        role: 'button',
        tabindex: -1,
        'aria-label': feature.properties.canonicalName,
        'aria-pressed': 'false',
      });
      const option = element('option', feature.properties.canonicalName);
      option.value = feature.id;
      nextOptions.push(option);
      const title = svgElement('title');
      title.textContent = feature.properties.canonicalName;
      node.append(title);
      node.addEventListener(
        'pointerenter',
        () => {
          const { selectableNeighborhoods, areaStyle, colors } = readPresentation();
          if (
            isDestroyed() ||
            !selectableNeighborhoods ||
            selected?.id === feature.id ||
            (!areaStyle.hoverFill && !areaStyle.hoverStroke)
          )
            return;
          node.setAttribute('fill', areaStyle.hoverFill ?? '#408dbe');
          node.setAttribute('fill-opacity', '.12');
          node.setAttribute('stroke', areaStyle.hoverStroke ?? colors.neighborhood ?? '#176ba2');
        },
        { signal: events.signal },
      );
      node.addEventListener(
        'pointerleave',
        () => {
          if (isDestroyed() || selected?.id === feature.id) return;
          node.setAttribute('fill', 'transparent');
          node.setAttribute('fill-opacity', '1');
          node.setAttribute('stroke', readPresentation().colors.neighborhood ?? '#9caebc');
        },
        { signal: events.signal },
      );
      return {
        feature,
        node,
        bounds,
        point: interiorAnchor(feature.geometry, project),
        area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]),
      };
    });
    return () => {
      if (isDestroyed()) {
        events.abort();
        return;
      }
      sourceEvents.abort();
      sourceEvents = events;
      const { mode, year } = readPresentation();
      const hadSelection = !!selected;
      source = next;
      sourceSelect.value = source;
      selected = undefined;
      const revision = ++neighborhoodRevision;
      delete root.dataset.selectedNeighborhood;
      root.dataset.source = source;
      crossfade(areas, () => areas.replaceChildren(...nextItems.map((item) => item.node)));
      neighborhoodSelect.replaceChildren(element('option', 'No neighborhood selected'));
      neighborhoodSelect.options[0].value = '';
      neighborhoodSelect.append(...nextOptions);
      items = nextItems;
      if (items[0]) items[0].node.setAttribute('tabindex', '0');
      refresh.source();
      status.textContent =
        mode === 'basemap'
          ? 'San Francisco basemap.'
          : mode === 'districts'
            ? `${year} supervisorial districts. Numbers identify each district.`
            : `${formatSourceLabel(source)}. Select a neighborhood to begin.`;
      if (hadSelection)
        root.dispatchEvent(
          new CustomEvent('neighborhoodchange', {
            bubbles: true,
            detail: { feature: null, source, id: null, name: null },
          }),
        );
      if (reset && !isDestroyed() && neighborhoodRevision === revision) resetView();
    };
  }
  function setSource(next: NeighborhoodSource) {
    if (!isDestroyed()) prepareSource(next)();
  }
  return {
    get source() {
      return source;
    },
    get selected() {
      return selected;
    },
    get items(): readonly NeighborhoodItem[] {
      return items;
    },
    getSelection,
    selectNeighborhood,
    prepareSource,
    setSource,
    destroy() {
      sourceEvents.abort();
    },
  };
}
