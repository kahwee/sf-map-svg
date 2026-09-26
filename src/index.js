import data from './data.js';

export const districtYears = Object.freeze([2002, 2012, 2022]);
export const neighborhoodNames = Object.freeze(data.neighborhoods.map(item => item.name));
export const districtColors = Object.freeze(['#c8dce5','#d5e4d6','#d1d6e8','#d0dfd7','#e4dcca','#d3dced','#d9d8e7','#c8dfdf','#e2d6ca','#cbdcd1','#dfddc9']);
const defaults = { water: '#e7f0f3', land: '#f1f3ee', district: '#71838a', neighborhood: '#8c9195', highway: '#bd8b73', label: '#304958', marker: '#245b61', selected: '#f04f32' };
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => Number(value.toFixed(2));
let sequence = 0;

function rawProject([longitude, latitude]) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) >= 90) throw new RangeError('Coordinates must be finite [longitude, latitude], with latitude between -90 and 90.');
  return [longitude * Math.PI / 180, -Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))];
}
function positions(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(positions);
  const result = [];
  const walk = coordinates => {
    if (typeof coordinates[0] === 'number') result.push(coordinates);
    else coordinates.forEach(walk);
  };
  walk(geometry.coordinates);
  return result;
}
function geometryPath(geometry, project) {
  if (!geometry) return '';
  const line = ring => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(number).join(',')}`).join('');
  const polygon = rings => rings.map(ring => `${line(ring)}Z`).join('');
  switch (geometry.type) {
    case 'Polygon': return polygon(geometry.coordinates);
    case 'MultiPolygon': return geometry.coordinates.map(polygon).join('');
    case 'LineString': return line(geometry.coordinates);
    case 'MultiLineString': return geometry.coordinates.map(line).join('');
    case 'GeometryCollection': return geometry.geometries.map(g => geometryPath(g, project)).join('');
    default: return '';
  }
}

/** Make an offline SVG and the matching longitude/latitude projection. */
export function createSFMap(options = {}) {
  const { width = 800, height = 800, padding = 28, year = 2022,
    districtLines = true, neighborhoodLines = false, districtFills = true,
    districtLabels = true, highways = false, markers = [],
    title = 'San Francisco map', idPrefix = `sf-map-${++sequence}` } = options;
  if (![width, height, padding].every(Number.isFinite) || width <= 0 || height <= 0 || padding < 0 || padding * 2 >= Math.min(width, height)) throw new RangeError('Use positive dimensions and padding smaller than half the map.');
  if (!districtYears.includes(year)) throw new RangeError('District year must be 2002, 2012, or 2022.');
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(idPrefix)) throw new TypeError('idPrefix must start with a letter and contain only letters, numbers, underscores, or hyphens.');
  const colors = {...defaults, ...options.colors};
  const points = positions(data.coast).map(rawProject);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const project = coordinates => {
    const [x, y] = rawProject(coordinates);
    return [(x - (minX + maxX) / 2) * scale + width / 2, (y - (minY + maxY) / 2) * scale + height / 2];
  };
  const path = geometry => geometryPath(geometry, project);
  const coastPath = path(data.coast);
  const districts = data.districts[year];
  const districtPath = district => path(district.geometry) + path(district.extras);
  const stroke = (color, weight) => `fill="none" stroke="${escape(color)}" stroke-width="${weight}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"`;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${idPrefix}-title" data-sf-map="" data-year="${year}" style="max-width:100%;height:auto"><title id="${idPrefix}-title">${escape(title)}</title><desc>San Francisco supervisorial district boundaries (${year}).${neighborhoodLines ? ' Dashed lines show approximate SF Find neighborhood areas, defined in 2006.' : ''} Geometry from DataSF. See package SOURCES.md.</desc><defs><clipPath id="${idPrefix}-coast"><path d="${coastPath}" fill-rule="evenodd"/></clipPath></defs><rect width="${width}" height="${height}" fill="${escape(colors.water)}"/><g data-layer="geography"><path data-layer="coast" d="${coastPath}" fill="${escape(colors.land)}" fill-rule="evenodd"/>`];
  if (districtFills) parts.push(`<g data-layer="district-fills" clip-path="url(#${idPrefix}-coast)">${districts.map(d => `<path data-district="${d.id}" d="${districtPath(d)}" fill="${districtColors[d.id - 1]}" fill-rule="evenodd"/>`).join('')}</g>`);
  if (highways) parts.push(`<g data-layer="highways">${data.highways.map(road => `<path data-route="${escape(road.route)}" d="${path(road.geometry)}" ${stroke(colors.highway, 1.4)}/>`).join('')}</g>`);
  if (neighborhoodLines) parts.push(`<g data-layer="neighborhood-lines" clip-path="url(#${idPrefix}-coast)">${data.neighborhoods.map(n => `<path data-neighborhood="${escape(n.name)}" d="${path(n.geometry)}" ${stroke(colors.neighborhood, .65)} stroke-dasharray="2 2"><title>${escape(n.name)}</title></path>`).join('')}</g>`);
  if (districtLines) parts.push(`<g data-layer="district-lines" clip-path="url(#${idPrefix}-coast)">${districts.map(d => `<path data-district="${d.id}" d="${districtPath(d)}" ${stroke(colors.district, 1.1)}/>`).join('')}</g>`);
  parts.push(`<path data-layer="coastline" d="${coastPath}" ${stroke(colors.district, .65)}/>`);
  if (districtLabels) parts.push(`<g data-layer="district-labels" font-family="system-ui,sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="${escape(colors.label)}">${[...districts.map(d => ({id:d.id,label:d.label})), {id:6,label:[-122.371,37.824]}].map(d => {const [x,y]=project(d.label).map(number);return `<g transform="translate(${x},${y})"><circle r="10" fill="#ffffff" fill-opacity=".9"/><text dy=".35em">${d.id}</text></g>`;}).join('')}</g>`);
  parts.push(`<g data-layer="markers">${markers.map(marker => {
    const [x,y] = project([marker.lng, marker.lat]).map(number);
    return `<circle data-marker-id="${escape(marker.id)}" cx="${x}" cy="${y}" r="${marker.selected ? 8 : 5}" fill="${escape(marker.color ?? (marker.selected ? colors.selected : colors.marker))}" stroke="#fff9e9" stroke-width="2" vector-effect="non-scaling-stroke"><title>${escape(marker.label ?? marker.id)}</title></circle>`;
  }).join('')}</g></g></svg>`);
  return { svg: parts.join(''), project, viewBox: [0, 0, width, height] };
}
export function renderSFMap(options = {}) { return createSFMap(options).svg; }
