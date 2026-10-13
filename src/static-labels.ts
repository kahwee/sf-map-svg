import type { Bounds } from '../data/types.js';
import { interiorAnchor, layoutLabels, projectedBounds } from './explorer-layout.js';
import type { Project } from './geometry.js';
import { labelCandidates, styleLabels } from './label-candidates.js';
import type { SFMapData } from './map-core.js';
import { escapeXml, number } from './svg.js';
import type { SFMapOptions } from './types.js';

/** Conservative portable metrics; the browser refines these with its actual font. */
export function estimateLabelWidth(text: string, fontSize: number) {
  return Array.from(text).reduce(
    (width, char) =>
      width +
      (/[\u0300-\u036f]/u.test(char)
        ? 0
        : /[\s.,:;'!|ilI]/u.test(char)
          ? 0.32
          : /[MW@%]/u.test(char)
            ? 0.95
            : (char.codePointAt(0) ?? 0) > 0x024f
              ? 1
              : /[A-Z]/u.test(char)
                ? 0.72
                : 0.6) *
        fontSize,
    0,
  );
}

/** Interactive overview rules, expressed entirely in screen pixels before serialization. */
export function staticLabels(data: SFMapData, options: SFMapOptions, project: Project) {
  const width = options.labelLayout?.width ?? options.width ?? 800;
  const unit = (options.width ?? 800) / width;
  const height = (options.height ?? 800) / unit;
  const point = (coordinates: Parameters<Project>[0]): [number, number] => {
    const [x, y] = project(coordinates);
    return [x / unit, y / unit];
  };
  const markers = options.markers ?? [];
  const marker = markers.find((item) => item.selected);
  const neighborhoods = options.neighborhoodLabels
    ? (data.neighborhoods ?? [])
        .map((item) => {
          const bounds = projectedBounds(item.geometry, point);
          return {
            ...item,
            point: interiorAnchor(item.geometry, point),
            area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]),
          };
        })
        .sort((a, b) => b.area - a.area || (a.id ?? a.name).localeCompare(b.id ?? b.name))
    : [];
  const districts =
    options.districtLabels !== false ? (data.districts?.[options.year ?? 2022] ?? []) : [];
  for (const district of districts)
    if (!Number.isFinite(district.id)) throw new TypeError('District IDs must be finite numbers.');
  const candidates = styleLabels(
    labelCandidates(
      {
        selected: marker
          ? [
              {
                point: point([marker.lng, marker.lat]),
                name: marker.label ?? marker.id,
                kind: 'selected-marker',
              },
            ]
          : [],
        districts:
          options.districtLabels !== false
            ? districts.flatMap((district) =>
                (district.labelPoints.length ? district.labelPoints : [district.label]).map(
                  (label) => ({ point: point(label), name: String(district.id), kind: 'district' }),
                ),
              )
            : [],
        stations: [], // Station names appear only after zooming; symbols remain at overview.
        parks: options.landmarks
          ? (data.landmarks ?? []).map((item) => ({
              point: point(item.label),
              name: item.name,
              kind: 'park',
            }))
          : [],
        roads:
          (options.roadLabels ?? options.keyRoads)
            ? (data.keyRoads ?? []).map((item) => ({
                point: point(item.label),
                name: item.name,
                level: item.level ?? 'primary',
                kind: 'road',
              }))
            : [],
        neighborhoods: neighborhoods.flatMap((item) =>
          item.point ? [{ point: item.point, name: item.name, kind: 'neighborhood' }] : [],
        ),
      },
      width,
      1,
    ),
    { colors: options.colors, markerRadius: marker?.radius ?? 6 },
  );
  const obstacles: Bounds[] = [
    ...(options.bartStations
      ? (data.bartStations ?? []).map((item): Bounds => {
          const [x, y] = point(item.coordinates);
          return [x - 6, y - 6, x + 6, y + 6];
        })
      : []),
    ...markers.map((item): Bounds => {
      const [x, y] = point([item.lng, item.lat]);
      // Also cover the legacy SVG marker when it is larger than its interactive counterpart.
      const radius =
        Math.max(item.radius ?? 6, (item.radius ?? (item.selected ? 8 : 5)) / unit) + 3;
      return [x - radius, y - radius, x + radius, y + radius];
    }),
  ];
  const placed = layoutLabels(
    candidates.map((item) => ({
      ...item,
      x: item.point[0],
      y: item.point[1],
      textWidth: estimateLabelWidth(item.name, item.fontSize),
      textHeight: item.fontSize * 1.25,
    })),
    width,
    height,
    obstacles,
  );
  return `<g data-layer="overview-labels" font-family="system-ui,sans-serif">${placed.map((item) => `<text data-label-kind="${escapeXml(item.kind)}" text-anchor="middle" x="${number((item.left + item.textWidth / 2) * unit)}" y="${number((item.top + item.fontSize) * unit)}" font-size="${number(item.fontSize * unit)}" font-weight="${item.fontWeight}" fill="${escapeXml(item.fill)}" stroke="${escapeXml(item.halo)}" stroke-width="${number(3 * unit)}" stroke-linejoin="round" paint-order="stroke">${escapeXml(item.name)}</text>`).join('')}</g>`;
}
