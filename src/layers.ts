import type { Geometry } from '../data/types.js';
import type { DistrictRow } from './data.js';
import type { Project } from './geometry.js';
import type { BartStation, KeyRoad, Landmark } from './overlays.js';
import type { MapMarker, SFMapOptions } from './types.js';

interface LayerContext {
  labels: boolean;
  theme: NonNullable<SFMapOptions['theme']>;
  idPrefix: string;
  colors: Required<NonNullable<SFMapOptions['colors']>>;
  project: Project;
  path: (geometry: Geometry | null | undefined) => string;
}
interface DistrictPath {
  id: number;
  path: string;
  color: string;
}

import { escapeXml, number, overlayLabel, stroke } from './svg.js';

export function districtFills(districts: readonly DistrictPath[], { idPrefix }: LayerContext) {
  return `<g data-layer="district-fills" clip-path="url(#${idPrefix}-coast)">${districts.map((d) => `<path data-district="${d.id}" d="${d.path}" fill="${escapeXml(d.color)}" fill-rule="evenodd"/>`).join('')}</g>`;
}
export function districtLines(
  districts: readonly DistrictPath[],
  { idPrefix, colors }: LayerContext,
) {
  return `<g data-layer="district-lines" clip-path="url(#${idPrefix}-coast)">${districts.map((d) => `<path data-district="${d.id}" d="${d.path}" ${stroke(colors.district, 1.1)}/>`).join('')}</g>`;
}
export function landmarks(items: readonly Landmark[], { idPrefix, path, colors }: LayerContext) {
  return `<g data-layer="landmarks" clip-path="url(#${idPrefix}-coast)">${items.map((item) => `<path data-landmark="${escapeXml(item.id)}" d="${path(item.geometry)}" fill="${escapeXml(colors.park)}" fill-rule="evenodd"><title>${escapeXml(item.name)}</title></path>`).join('')}</g>`;
}
export function highways(
  items: readonly { route: string; geometry: Geometry }[],
  { path, colors, theme }: LayerContext,
) {
  return `<g data-layer="highways">${items.map((road) => `<path data-route="${escapeXml(road.route)}" d="${path(road.geometry)}" ${stroke(colors.highway, theme === 'transit' ? 2 : 1.4)}/>`).join('')}</g>`;
}
export function neighborhoods(
  items: readonly { name: string; geometry: Geometry }[],
  { idPrefix, path, colors }: LayerContext,
) {
  return `<g data-layer="neighborhood-lines" clip-path="url(#${idPrefix}-coast)">${items.map((n) => `<path data-neighborhood="${escapeXml(n.name)}" d="${path(n.geometry)}" ${stroke(colors.neighborhood, 0.65)} stroke-dasharray="2 2"><title>${escapeXml(n.name)}</title></path>`).join('')}</g>`;
}
export function districtLabels(
  districts: readonly DistrictRow[],
  { project, colors }: LayerContext,
) {
  // Primary badges first, then island badges, matching the original layer order.
  const labels = [
    ...districts.map((d) => ({ id: d.id, label: d.labelPoints[0] })),
    ...districts.flatMap((d) => d.labelPoints.slice(1).map((label) => ({ id: d.id, label }))),
  ];
  return `<g data-layer="district-labels" font-family="system-ui,sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="${escapeXml(colors.label)}">${labels
    .map((d) => {
      const [x, y] = project(d.label).map(number);
      return `<g transform="translate(${x},${y})"><circle r="10" fill="#ffffff" fill-opacity=".9"/><text dy=".35em">${d.id}</text></g>`;
    })
    .join('')}</g>`;
}
export function landmarkLabels(items: readonly Landmark[], { project, colors }: LayerContext) {
  return `<g data-layer="landmark-labels" ${overlayLabel} fill="${escapeXml(colors.landmark)}">${items
    .map((item) => {
      const [x, y] = project(item.label);
      return `<text x="${number(x + item.offset[0])}" y="${number(y + item.offset[1])}" text-anchor="${escapeXml(item.anchor)}" dominant-baseline="middle">${escapeXml(item.name)}</text>`;
    })
    .join('')}</g>`;
}
export function bartStations(
  items: readonly BartStation[],
  { project, colors, labels }: LayerContext,
) {
  return `<g data-layer="bart-stations">${items
    .map((station) => {
      const [x, y] = project(station.coordinates).map(number);
      return `<g data-bart-station="${escapeXml(station.id)}" transform="translate(${x},${y})"><title>${escapeXml(station.name)} BART station</title><circle r="5" fill="#fff" stroke="${escapeXml(colors.bart)}" stroke-width="2.5"/><circle r="1.5" fill="${escapeXml(colors.bart)}"/>${labels ? `<text x="10" y="4" ${overlayLabel} fill="${escapeXml(colors.bart)}">${escapeXml(station.name)}</text>` : ''}</g>`;
    })
    .join('')}</g>`;
}
export function markers(items: readonly MapMarker[], { project, colors }: LayerContext) {
  return `<g data-layer="markers">${items
    .map((marker) => {
      const [x, y] = project([marker.lng, marker.lat]).map(number);
      return `<circle data-marker-id="${escapeXml(marker.id)}" cx="${x}" cy="${y}" r="${marker.selected ? 8 : 5}" fill="${escapeXml(marker.color ?? (marker.selected ? colors.selected : colors.marker))}" stroke="#fff9e9" stroke-width="2" vector-effect="non-scaling-stroke"><title>${escapeXml(marker.label ?? marker.id)}</title></circle>`;
    })
    .join('')}</g>`;
}

export function keyRoads(items: readonly KeyRoad[], { idPrefix, path, colors }: LayerContext) {
  return `<g data-layer="key-roads" clip-path="url(#${idPrefix}-coast)">${items.map((road) => `<path data-key-road="${escapeXml(road.id)}" d="${path(road.geometry)}" ${stroke(colors.road, 1)}><title>${escapeXml(road.name)}</title></path>`).join('')}</g>`;
}
export function keyRoadLabels(items: readonly KeyRoad[], { project }: LayerContext) {
  return `<g data-layer="key-road-labels" ${overlayLabel} fill="#77736b">${items
    .map((road) => {
      const [x, y] = project(road.label);
      return `<text x="${number(x)}" y="${number(y - 5)}" text-anchor="middle">${escapeXml(road.name)}</text>`;
    })
    .join('')}</g>`;
}
