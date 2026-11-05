import type { NeighborhoodSource, Position } from '../../data/types.js';
import type { MapAppearance, MapConfiguration } from '../controller-types.js';
import { prepareDistrictStyles } from '../district-style.js';
import type { InteractiveSFMapData } from '../explorer-data.js';
import type { createNeighborhoodLayer } from '../neighborhood-layer.js';
import { getLayerPathsWithData } from '../rendering/svg-map-renderer.js';
import type { DistrictYear, ExplorerMode } from '../types.js';
import type { PreparedPresentation } from './configuration-controller.js';
import type { createDistrictController } from './district-controller.js';

type DistrictController = ReturnType<typeof createDistrictController>;
type PresentationHost = {
  data: InteractiveSFMapData;
  sources: readonly NeighborhoodSource[];
  districts: Pick<DistrictController, 'style' | 'styles' | 'revision'>;
  neighborhoods: Pick<
    ReturnType<typeof createNeighborhoodLayer>,
    'source' | 'items' | 'prepareSource'
  >;
  readState(): { year: DistrictYear; mode: ExplorerMode };
  isDisposed(): boolean;
  project(point: Position): [number, number];
  applyAppearance(
    appearance: MapAppearance,
    style: DistrictController['style'],
    prepared: DistrictController['styles'],
    year: DistrictYear,
  ): void;
  applyYear: DistrictController['setDistrictYear'];
  applyMode(mode: ExplorerMode): void;
  applyLabels(visible: boolean): void;
  scheduleLabels(): void;
};

/** Own revision guards and single-use cross-layer presentation transactions. */
export function createPresentationController(host: PresentationHost) {
  const {
    data,
    districts,
    neighborhoods,
    project,
    applyYear,
    applyMode,
    applyLabels,
    scheduleLabels,
  } = host;
  const collections = data.neighborhoods;
  let presentationRevision = 0;
  function preparePresentation(patch: MapConfiguration): PreparedPresentation | undefined {
    const revision = ++presentationRevision;
    const { year, mode } = host.readState();
    const nextYear = patch.year ?? year;
    const nextMode = patch.mode ?? mode;
    if (
      (patch.year !== undefined || nextMode === 'districts') &&
      (!data.map.districts?.[nextYear] || !data.districts?.[nextYear])
    )
      throw new RangeError(`No ${nextYear} district dataset was supplied.`);
    if (nextMode === 'neighborhoods' && !host.sources.length)
      throw new RangeError('No neighborhood dataset was supplied.');
    if (patch.source !== undefined && !Object.hasOwn(collections, patch.source))
      throw new RangeError(`Unknown neighborhood source: ${patch.source}`);
    const commitSource =
      patch.source !== undefined && patch.source !== neighborhoods.source
        ? neighborhoods.prepareSource(patch.source, false)
        : undefined;
    const appearance: MapAppearance | undefined = patch.appearance;
    const nextStyle = appearance ? appearance.districtStyle : districts.style;
    const districtVersion = districts.revision;
    const prepared =
      appearance || nextYear !== year
        ? prepareDistrictStyles(data.map.districts?.[nextYear] ?? [], nextStyle)
        : districts.styles;
    if (
      host.isDisposed() ||
      revision !== presentationRevision ||
      districtVersion !== districts.revision
    )
      return undefined;
    if (nextYear !== year) {
      // Validate target paths and label coordinates before any presentation group commits.
      getLayerPathsWithData({ year: nextYear }, data.map, false);
      for (const feature of data.districts?.[nextYear]?.features ?? [])
        for (const point of feature.properties.labelPoints) project(point);
    }
    let consumed = false;
    return {
      commit(onCommit, isCurrent) {
        if (
          consumed ||
          host.isDisposed() ||
          !isCurrent() ||
          revision !== presentationRevision ||
          districtVersion !== districts.revision
        )
          return false;
        consumed = true;
        onCommit();
        if (
          host.isDisposed() ||
          !isCurrent() ||
          revision !== presentationRevision ||
          districtVersion !== districts.revision
        )
          return false;

        if (appearance) host.applyAppearance(appearance, nextStyle, prepared, nextYear);
        if (nextYear !== year) applyYear(nextYear, {}, prepared);
        if (host.isDisposed() || revision !== presentationRevision || !isCurrent()) return false;
        commitSource?.();
        if (host.isDisposed() || revision !== presentationRevision || !isCurrent()) return false;
        if (commitSource && appearance)
          for (const item of neighborhoods.items)
            item.node.setAttribute('stroke', appearance.colors?.neighborhood ?? '#9caebc');
        if (patch.mode !== undefined) applyMode(patch.mode);
        if (patch.labels !== undefined) applyLabels(patch.labels);
        scheduleLabels();
        return true;
      },
    };
  }
  return { prepare: preparePresentation };
}
