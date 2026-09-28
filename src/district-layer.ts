import type { DistrictRowData } from './map-core.js';
import { districtColors } from './map-core.js';
import type { DistrictStyle, DistrictYear, SFMapOptions } from './types.js';

/** Apply prepared styles and interaction state without invoking consumer callbacks. */
export function renderDistrictAppearance({
  svg,
  rows,
  styles,
  selectedDistrict,
  hoveredDistrict,
  year,
  theme,
  colors,
  fills,
  lines,
}: {
  svg: SVGSVGElement;
  rows: readonly DistrictRowData[];
  styles: ReadonlyMap<number, DistrictStyle>;
  selectedDistrict: number | null;
  hoveredDistrict: number | null;
  year: DistrictYear;
  theme: SFMapOptions['theme'];
  colors: NonNullable<SFMapOptions['colors']>;
  fills: boolean;
  lines: boolean;
}) {
  for (const row of rows) {
    const styled = styles.get(row.id);
    const active = selectedDistrict === row.id;
    const hovered = hoveredDistrict === row.id;
    const fill = svg.querySelector<SVGPathElement>(
      `[data-layer="district-fills"] [data-district="${row.id}"]`,
    );
    const line = svg.querySelector<SVGPathElement>(
      `[data-layer="district-lines"] [data-district="${row.id}"]`,
    );
    if (fill) {
      fill.setAttribute(
        'fill',
        styled?.fill ??
          (theme === 'transit' ? (colors.land ?? '#fcfcf8') : districtColors[row.id - 1]),
      );
      if (styled?.opacity === undefined) fill.removeAttribute('fill-opacity');
      else fill.setAttribute('fill-opacity', String(styled.opacity));
      fill.setAttribute('role', 'button');
      fill.setAttribute('aria-label', `District ${row.id}, ${year}`);
      fill.setAttribute('aria-pressed', String(active));
      fill.setAttribute('tabindex', row.id === 1 ? '0' : '-1');
      fill.style.cursor = 'pointer';
    }
    if (line) {
      line.setAttribute(
        'stroke',
        active
          ? (colors.selected ?? '#f04f32')
          : hovered
            ? '#163e56'
            : (styled?.stroke ?? colors.district ?? '#a7b8c0'),
      );
      line.setAttribute('stroke-width', active ? '3' : hovered ? '2.2' : '1.1');
      const lineInteractive = !fills && lines;
      line.style.pointerEvents = lineInteractive ? 'stroke' : 'none';
      if (lineInteractive) {
        line.setAttribute('role', 'button');
        line.setAttribute('aria-label', `District ${row.id}, ${year}`);
        line.setAttribute('aria-pressed', String(active));
        line.setAttribute('tabindex', row.id === 1 ? '0' : '-1');
        line.style.cursor = 'pointer';
      } else {
        line.removeAttribute('role');
        line.removeAttribute('aria-label');
        line.removeAttribute('aria-pressed');
        line.removeAttribute('tabindex');
      }
      if (styled?.opacity === undefined) line.removeAttribute('stroke-opacity');
      else line.setAttribute('stroke-opacity', String(styled.opacity));
    }
  }
}
