import type { Geometry, Position } from '../../data/types.js';
import { prepareDistrictStyles } from '../district-style.js';
import type { InteractiveSFMapData } from '../explorer-data.js';
import type { normalizeFeatures } from '../features.js';
import type { LabelItem } from '../label-candidates.js';
import { getLayerPathsWithData } from '../rendering/svg-map-renderer.js';
import type {
  CameraOptions,
  DistrictSelection,
  DistrictYear,
  NeighborhoodExplorerOptions,
} from '../types.js';
import { validateCameraOptions } from './camera.js';
import { renderDistrictAppearance } from './district-layer.js';
import { createDistrictMorph } from './district-morph.js';
import { createDistrictTransition } from './district-transition.js';
import { svgElement } from './dom.js';

type Host = {
  root: HTMLElement;
  svg: SVGSVGElement;
  status: HTMLElement;
  data: InteractiveSFMapData;
  districtLayers: SVGGElement[];
  get year(): DistrictYear;
  set year(value: DistrictYear);
  get theme(): NeighborhoodExplorerOptions['theme'];
  get colors(): NonNullable<NeighborhoodExplorerOptions['colors']>;
  get features(): ReturnType<typeof normalizeFeatures>;
  get destroyed(): boolean;
  get initialized(): boolean;
  reducedMotion: MediaQueryList;
  enabled(layer: 'districtFills' | 'districtLines'): boolean;
  fadeDuration(): number;
  fitGeometry(geometry: Geometry, padding: undefined, options: CameraOptions): void;
  project(point: Position): [number, number];
  setLabels(items: LabelItem[]): void;
  syncLayerComposition(): void;
  scheduleLabels(): void;
};

/** Owns district selection, styles, revisions and cancellable motion. */
export function createDistrictController(
  host: Host,
  initialDistrictStyle: NeighborhoodExplorerOptions['districtStyle'],
) {
  const {
    root,
    svg,
    status,
    data,
    districtLayers,
    reducedMotion,
    enabled,
    fitGeometry,
    syncLayerComposition,
    scheduleLabels,
  } = host;
  const districtMorph = createDistrictMorph();
  let selectedDistrict: number | null = null;
  let hoveredDistrict: number | null = null;
  let districtStyle = initialDistrictStyle;
  let districtStyles = prepareDistrictStyles(data.map.districts?.[host.year] ?? [], districtStyle);
  const districtTransition = createDistrictTransition();
  let districtRevision = 0;
  root.dataset.year = String(host.year);
  function districtRow(id: number) {
    return data.map.districts?.[host.year]?.find((district) => district.id === id);
  }
  function districtSelection(
    id: number | null,
  ): DistrictSelection | { id: null; year: DistrictYear; district: null } {
    const district = id === null ? undefined : districtRow(id);
    return district
      ? { id: district.id, year: host.year, district: structuredClone(district) }
      : { id: null, year: host.year, district: null };
  }
  function getSelectedDistrict(): DistrictSelection | null {
    return selectedDistrict === null
      ? null
      : (districtSelection(selectedDistrict) as DistrictSelection);
  }
  function updateDistrictAppearance() {
    renderDistrictAppearance({
      svg,
      rows: data.map.districts?.[host.year] ?? [],
      styles: districtStyles,
      selectedDistrict,
      hoveredDistrict,
      year: host.year,
      theme: host.theme,
      colors: host.colors,
      fills: enabled('districtFills'),
      lines: enabled('districtLines'),
    });
  }
  function selectDistrict(id: number | null, options: { fit?: boolean } & CameraOptions = {}) {
    if (host.destroyed) return false;
    validateCameraOptions(options);
    if (id !== null && (!Number.isInteger(id) || !districtRow(id))) return false;
    const changed = selectedDistrict !== id;
    const revision = ++districtRevision;
    selectedDistrict = id;
    if (id === null) delete root.dataset.selectedDistrict;
    else root.dataset.selectedDistrict = String(id);
    updateDistrictAppearance();
    const selectedRow = id === null ? undefined : districtRow(id);
    if (selectedRow && options.fit) fitGeometry(selectedRow.geometry, undefined, options);
    if (host.destroyed || revision !== districtRevision) return true;
    status.textContent =
      id === null
        ? 'District selection cleared.'
        : `District ${id} selected, ${host.year} boundaries.`;
    if (changed)
      root.dispatchEvent(
        new CustomEvent('districtchange', { bubbles: true, detail: districtSelection(id) }),
      );
    return true;
  }
  function activateDistrict(id: number) {
    const revision = districtRevision + 1;
    if (!selectDistrict(id) || host.destroyed || revision !== districtRevision) return false;
    root.dispatchEvent(
      new CustomEvent('districtactivate', { bubbles: true, detail: districtSelection(id) }),
    );
    return !host.destroyed && revision === districtRevision;
  }
  function setDistrictStyle(style: typeof districtStyle) {
    if (host.destroyed) return;
    const revision = districtRevision;
    const prepared = prepareDistrictStyles(data.map.districts?.[host.year] ?? [], style);
    if (host.destroyed || revision !== districtRevision) return;
    districtRevision++;
    districtStyle = style;
    districtStyles = prepared;
    const fills = districtLayers.find((layer) => layer.dataset.layer === 'district-fills');
    const fade = host.fadeDuration();
    // A new style settles any fill crossfade still running from an earlier change.
    districtTransition.cancel();
    if (fills && fade && enabled('districtFills')) districtTransition.fade(fills, fade);
    updateDistrictAppearance();
  }
  function setDistrictYear(
    next: DistrictYear,
    options: CameraOptions = {},
    preparedStyles?: ReturnType<typeof prepareDistrictStyles>,
  ) {
    if (host.destroyed) return;
    validateCameraOptions(options);
    if (![2002, 2012, 2022].includes(next))
      throw new RangeError('District year must be 2002, 2012, or 2022.');
    if (!data.map.districts?.[next] || !data.districts?.[next])
      throw new RangeError(`No ${next} district dataset was supplied.`);
    if (next === host.year) return;
    const revision = districtRevision;
    const prepared =
      preparedStyles ?? prepareDistrictStyles(data.map.districts[next], districtStyle);
    if (host.destroyed || revision !== districtRevision) return;
    const committedRevision = ++districtRevision;
    const geometry = getLayerPathsWithData({ year: next }, data.map, false);
    const previousYear = host.year;
    districtTransition.cancel();
    districtMorph.stop();
    const lineLayer = districtLayers.find((layer) => layer.dataset.layer === 'district-lines');
    const morph =
      host.features.districtMorph &&
      options.animate !== false &&
      host.initialized &&
      !reducedMotion.matches &&
      (enabled('districtLines') || enabled('districtFills'))
        ? host.features.districtMorph
        : false;
    const previousOutlines =
      morph && lineLayer
        ? new Map(
            [...lineLayer.querySelectorAll<SVGPathElement>('path[data-district]')].map((path) => [
              path.dataset.district ?? '',
              path.getAttribute('d') ?? '',
            ]),
          )
        : undefined;
    for (const layer of districtLayers) {
      if (morph) {
        // The morph replaces the line crossfade; fills fade across the whole morph.
        if (layer !== lineLayer) districtTransition.fade(layer, morph.duration);
      } else if (options.animate && !reducedMotion.matches)
        districtTransition.fade(layer, options.duration ?? 280);
      layer.replaceChildren(
        ...geometry.districts.map((district) =>
          svgElement('path', {
            'data-district': district.id,
            d: district.path,
            ...(layer.dataset.layer === 'district-fills'
              ? { 'fill-rule': 'evenodd' }
              : { fill: 'none', 'stroke-width': 1.1 }),
          }),
        ),
      );
    }
    host.year = next;
    districtStyles = prepared;
    hoveredDistrict = null;
    root.dataset.year = String(host.year);
    svg.dataset.year = String(host.year);
    host.setLabels(
      (data.districts[next]?.features ?? []).flatMap((feature) =>
        feature.properties.labelPoints.map((point) => ({
          point: host.project(point),
          name: String(feature.properties.district),
          kind: 'district',
        })),
      ),
    );
    if (selectedDistrict !== null && !districtRow(selectedDistrict)) selectedDistrict = null;
    if (selectedDistrict === null) delete root.dataset.selectedDistrict;
    updateDistrictAppearance();
    syncLayerComposition();
    if (morph && lineLayer && previousOutlines)
      districtMorph.start(lineLayer, previousOutlines, {
        duration: morph.duration,
        stroke: host.colors.district ?? '#71838a',
      });
    scheduleLabels();
    status.textContent = `${host.year} supervisorial districts.`;
    root.dispatchEvent(
      new CustomEvent('districtyearchange', {
        bubbles: true,
        detail: { year: host.year, previousYear },
      }),
    );
    if (!host.destroyed && committedRevision === districtRevision && selectedDistrict !== null)
      root.dispatchEvent(
        new CustomEvent('districtchange', {
          bubbles: true,
          detail: districtSelection(selectedDistrict),
        }),
      );
  }

  return {
    districtRow,
    districtSelection,
    getSelectedDistrict,
    updateDistrictAppearance,
    selectDistrict,
    activateDistrict,
    setDistrictStyle,
    setDistrictYear,
    transition: districtTransition,
    morph: districtMorph,
    get revision() {
      return districtRevision;
    },
    invalidate() {
      districtRevision++;
    },
    get style() {
      return districtStyle;
    },
    get styles() {
      return districtStyles;
    },
    commitStyles(style: typeof districtStyle, styles: typeof districtStyles) {
      districtStyle = style;
      districtStyles = styles;
    },
    get hovered() {
      return hoveredDistrict;
    },
    set hovered(id: number | null) {
      hoveredDistrict = id;
    },
  };
}
