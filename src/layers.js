import { escape, number, stroke, overlayLabel } from './svg.js';

export function districtFills(districts, { idPrefix }) {
  return `<g data-layer="district-fills" clip-path="url(#${idPrefix}-coast)">${districts.map((d) => `<path data-district="${d.id}" d="${d.path}" fill="${d.color}" fill-rule="evenodd"/>`).join('')}</g>`;
}
export function districtLines(districts, { idPrefix, colors }) {
  return `<g data-layer="district-lines" clip-path="url(#${idPrefix}-coast)">${districts.map((d) => `<path data-district="${d.id}" d="${d.path}" ${stroke(colors.district, 1.1)}/>`).join('')}</g>`;
}
export function landmarks(items, { idPrefix, path, colors }) {
  return `<g data-layer="landmarks" clip-path="url(#${idPrefix}-coast)">${items.map((item) => `<path data-landmark="${escape(item.id)}" d="${path(item.geometry)}" fill="${escape(colors.park)}" fill-rule="evenodd"><title>${escape(item.name)}</title></path>`).join('')}</g>`;
}
export function highways(items, { path, colors }) {
  return `<g data-layer="highways">${items.map((road) => `<path data-route="${escape(road.route)}" d="${path(road.geometry)}" ${stroke(colors.highway, 1.4)}/>`).join('')}</g>`;
}
export function neighborhoods(items, { idPrefix, path, colors }) {
  return `<g data-layer="neighborhood-lines" clip-path="url(#${idPrefix}-coast)">${items.map((n) => `<path data-neighborhood="${escape(n.name)}" d="${path(n.geometry)}" ${stroke(colors.neighborhood, 0.65)} stroke-dasharray="2 2"><title>${escape(n.name)}</title></path>`).join('')}</g>`;
}
export function districtLabels(districts, { project, colors }) {
  // Primary badges first, then island badges, matching the original layer order.
  const labels = [
    ...districts.map((d) => ({ id: d.id, label: d.labelPoints[0] })),
    ...districts.flatMap((d) => d.labelPoints.slice(1).map((label) => ({ id: d.id, label }))),
  ];
  return `<g data-layer="district-labels" font-family="system-ui,sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="${escape(colors.label)}">${labels
    .map((d) => {
      const [x, y] = project(d.label).map(number);
      return `<g transform="translate(${x},${y})"><circle r="10" fill="#ffffff" fill-opacity=".9"/><text dy=".35em">${d.id}</text></g>`;
    })
    .join('')}</g>`;
}
export function landmarkLabels(items, { project, colors }) {
  return `<g data-layer="landmark-labels" ${overlayLabel} fill="${escape(colors.landmark)}">${items
    .map((item) => {
      const [x, y] = project(item.label);
      return `<text x="${number(x + item.offset[0])}" y="${number(y + item.offset[1])}" text-anchor="${escape(item.anchor)}" dominant-baseline="middle">${escape(item.name)}</text>`;
    })
    .join('')}</g>`;
}
export function bartStations(items, { project, colors }) {
  return `<g data-layer="bart-stations">${items
    .map((station) => {
      const [x, y] = project(station.coordinates).map(number);
      return `<g data-bart-station="${escape(station.id)}" transform="translate(${x},${y})"><title>${escape(station.name)} BART station</title><circle r="5" fill="#fff" stroke="${escape(colors.bart)}" stroke-width="2.5"/><circle r="1.5" fill="${escape(colors.bart)}"/><text x="10" y="4" ${overlayLabel} fill="${escape(colors.bart)}">${escape(station.name)}</text></g>`;
    })
    .join('')}</g>`;
}
export function markers(items, { project, colors }) {
  return `<g data-layer="markers">${items
    .map((marker) => {
      const [x, y] = project([marker.lng, marker.lat]).map(number);
      return `<circle data-marker-id="${escape(marker.id)}" cx="${x}" cy="${y}" r="${marker.selected ? 8 : 5}" fill="${escape(marker.color ?? (marker.selected ? colors.selected : colors.marker))}" stroke="#fff9e9" stroke-width="2" vector-effect="non-scaling-stroke"><title>${escape(marker.label ?? marker.id)}</title></circle>`;
    })
    .join('')}</g>`;
}
