import type { NeighborhoodExplorerOptions } from './types.js';

export interface LabelItem {
  point: [number, number];
  name: string;
  kind: string;
  level?: 'primary' | 'secondary';
}
export interface RenderLabel extends LabelItem {
  fontSize: number;
  fontWeight: number;
  fill: string;
  halo: string;
  offset: number;
}

/** Shared priority and overview visibility for server and browser labels. */
export function labelCandidates(
  groups: {
    selected: LabelItem[];
    districts: LabelItem[];
    stations: LabelItem[];
    parks: LabelItem[];
    roads: LabelItem[];
    neighborhoods: LabelItem[];
  },
  width: number,
  zoom: number,
): LabelItem[] {
  return [
    ...groups.selected,
    ...groups.districts,
    ...(zoom >= 1.8 ? groups.stations : []),
    ...groups.parks.filter(
      (park) =>
        zoom >= 1.8 ||
        park.name === 'Golden Gate Park' ||
        (width >= 550 && park.name === 'Presidio'),
    ),
    ...groups.roads.filter((road) => road.level === 'primary' || zoom >= 1.8),
    ...groups.neighborhoods,
  ];
}

export function styleLabels(
  candidates: LabelItem[],
  {
    colors = {},
    labelStyle = {},
    labelSize = {},
    markerRadius = 6,
  }: Pick<NeighborhoodExplorerOptions, 'colors' | 'labelStyle' | 'labelSize' | 'markerRadius'>,
): RenderLabel[] {
  return candidates.map((item) => ({
    ...item,
    fontSize: Math.max(
      labelSize.min ?? 11,
      Math.min(labelSize.max ?? 12, item.kind === 'road' ? 11 : 12),
    ),
    fontWeight:
      labelStyle.fontWeight ??
      (item.kind.startsWith('selected') || item.kind === 'district' ? 700 : 550),
    fill:
      colors.label ??
      (item.kind === 'park'
        ? (colors.landmark ?? '#426641')
        : item.kind === 'road'
          ? '#77736b'
          : '#163d61'),
    halo: labelStyle.haloColor ?? '#ffffff',
    offset: item.kind === 'selected-marker' ? markerRadius + 9 : item.kind === 'bart' ? 11 : 0,
  }));
}
