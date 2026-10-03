const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function fail(file, path, message) {
  throw new TypeError(`${file}:${path} ${message}`);
}

function record(value, file, path) {
  if (!isRecord(value)) fail(file, path, 'must be an object');
  return value;
}

function string(value, file, path) {
  if (typeof value !== 'string' || value.length === 0)
    fail(file, path, 'must be a non-empty string');
}

function position(value, file, path) {
  if (!Array.isArray(value) || value.length < 2 || !value.every(isFiniteNumber))
    fail(file, path, 'must contain at least two finite coordinates');
  if (value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90)
    fail(file, path, 'must use WGS84 longitude and latitude ranges');
}

function positions(value, file, path, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum)
    fail(file, path, `must be an array with at least ${minimum} positions`);
  value.forEach((point, index) => {
    position(point, file, `${path}[${index}]`);
  });
}

function linearRing(value, file, path) {
  positions(value, file, path, 4);
  const first = value[0];
  const last = value[value.length - 1];
  if (first.length !== last.length || first.some((coordinate, index) => coordinate !== last[index]))
    fail(file, path, 'must be closed by repeating its first position');
}

function geometry(value, file, path) {
  record(value, file, path);
  switch (value.type) {
    case 'Point':
      position(value.coordinates, file, `${path}.coordinates`);
      break;
    case 'MultiPoint':
    case 'LineString':
      positions(
        value.coordinates,
        file,
        `${path}.coordinates`,
        value.type === 'LineString' ? 2 : 0,
      );
      break;
    case 'MultiLineString':
      if (!Array.isArray(value.coordinates)) fail(file, `${path}.coordinates`, 'must be an array');
      value.coordinates.forEach((line, index) => {
        positions(line, file, `${path}.coordinates[${index}]`, 2);
      });
      break;
    case 'Polygon':
      if (!Array.isArray(value.coordinates)) fail(file, `${path}.coordinates`, 'must be an array');
      if (!value.coordinates.length)
        fail(file, `${path}.coordinates`, 'must contain an exterior ring');
      value.coordinates.forEach((ring, index) => {
        linearRing(ring, file, `${path}.coordinates[${index}]`);
      });
      break;
    case 'MultiPolygon':
      if (!Array.isArray(value.coordinates)) fail(file, `${path}.coordinates`, 'must be an array');
      value.coordinates.forEach((polygon, polygonIndex) => {
        if (!Array.isArray(polygon) || !polygon.length)
          fail(file, `${path}.coordinates[${polygonIndex}]`, 'must contain an exterior ring');
        polygon.forEach((ring, ringIndex) => {
          linearRing(ring, file, `${path}.coordinates[${polygonIndex}][${ringIndex}]`);
        });
      });
      break;
    case 'GeometryCollection':
      if (!Array.isArray(value.geometries)) fail(file, `${path}.geometries`, 'must be an array');
      value.geometries.forEach((item, index) => {
        geometry(item, file, `${path}.geometries[${index}]`);
      });
      break;
    default:
      fail(file, `${path}.type`, `has unsupported geometry type ${String(value.type)}`);
  }
}

function strings(value, file, path) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    fail(file, path, 'must be an array of strings');
}

function validateProperties(properties, role, file, path) {
  record(properties, file, path);
  const requiredString = (...keys) => {
    keys.forEach((key) => {
      string(properties[key], file, `${path}.${key}`);
    });
  };
  switch (role) {
    case 'coast':
      requiredString('name');
      break;
    case 'district':
      requiredString('name');
      if (
        !Number.isInteger(properties.district) ||
        properties.district < 1 ||
        properties.district > 11
      )
        fail(file, `${path}.district`, 'must be an integer from 1 to 11');
      if (![2002, 2012, 2022].includes(properties.year))
        fail(file, `${path}.year`, 'has an unsupported year');
      position(properties.label, file, `${path}.label`);
      if (!Array.isArray(properties.labelPoints) || properties.labelPoints.length === 0)
        fail(file, `${path}.labelPoints`, 'must contain at least one position');
      properties.labelPoints.forEach((point, index) => {
        position(point, file, `${path}.labelPoints[${index}]`);
      });
      if (properties.displayExtras !== null)
        geometry(properties.displayExtras, file, `${path}.displayExtras`);
      break;
    case 'neighborhood':
      requiredString('name', 'canonicalName', 'sourceName');
      if (!['realtor', 'sf-find', 'analysis'].includes(properties.definitionSource))
        fail(file, `${path}.definitionSource`, 'has an unsupported source');
      strings(properties.aliases, file, `${path}.aliases`);
      strings(properties.nameSources, file, `${path}.nameSources`);
      for (const key of ['note', 'sourceCode', 'realtorDistrict'])
        if (
          properties[key] !== undefined &&
          properties[key] !== null &&
          typeof properties[key] !== 'string'
        )
          fail(file, `${path}.${key}`, 'must be a string when present');
      break;
    case 'highway':
      if (typeof properties.route !== 'string' && typeof properties.route !== 'number')
        fail(file, `${path}.route`, 'must be a string or number');
      break;
    case 'road':
      requiredString('name');
      if (properties.level !== undefined && !['primary', 'secondary'].includes(properties.level))
        fail(file, `${path}.level`, 'must be primary or secondary');
      if (properties.sourceNames !== undefined)
        strings(properties.sourceNames, file, `${path}.sourceNames`);
      if (properties.segmentIds !== undefined)
        strings(properties.segmentIds, file, `${path}.segmentIds`);
      if (properties.label !== undefined) position(properties.label, file, `${path}.label`);
      break;
    case 'landmark':
      requiredString('name');
      position(properties.label, file, `${path}.label`);
      if (
        !Array.isArray(properties.offset) ||
        properties.offset.length !== 2 ||
        !properties.offset.every(isFiniteNumber)
      )
        fail(file, `${path}.offset`, 'must be a pair of finite numbers');
      if (!['middle', 'start', 'end'].includes(properties.anchor))
        fail(file, `${path}.anchor`, 'must be middle, start, or end');
      break;
    case 'station':
      requiredString('name');
      break;
    default:
      fail(file, path, `has unknown dataset role ${role}`);
  }
}

const expectedGeometry = {
  coast: ['MultiPolygon'],
  district: ['Polygon'],
  neighborhood: ['MultiPolygon'],
  highway: ['LineString'],
  road: ['MultiLineString'],
  landmark: ['MultiPolygon'],
  station: ['Point'],
};

export function validateMapFeatureCollection(value, role, file) {
  record(value, file, '$');
  if (value.type !== 'FeatureCollection') fail(file, '$.type', 'must be FeatureCollection');
  if (value.schemaVersion !== 1) fail(file, '$.schemaVersion', 'must be 1');
  for (const key of ['id', 'title', 'coordinateSystem']) string(value[key], file, `$.${key}`);
  record(value.definition, file, '$.definition');
  string(value.definition.kind, file, '$.definition.kind');
  string(value.definition.description, file, '$.definition.description');
  if (!Array.isArray(value.sources) || value.sources.length === 0)
    fail(file, '$.sources', 'must not be empty');
  value.sources.forEach((source, index) => {
    const path = `$.sources[${index}]`;
    record(source, file, path);
    for (const key of ['id', 'title', 'url', 'retrievedAt', 'licenseUrl'])
      string(source[key], file, `${path}.${key}`);
  });
  if (!Array.isArray(value.features) || value.features.length === 0)
    fail(file, '$.features', 'must not be empty');
  const allowed = expectedGeometry[role];
  value.features.forEach((feature, index) => {
    const path = `$.features[${index}]`;
    record(feature, file, path);
    if (feature.type !== 'Feature') fail(file, `${path}.type`, 'must be Feature');
    string(feature.id, file, `${path}.id`);
    if (
      !Array.isArray(feature.bbox) ||
      feature.bbox.length !== 4 ||
      !feature.bbox.every(isFiniteNumber)
    )
      fail(file, `${path}.bbox`, 'must contain four finite numbers');
    validateProperties(feature.properties, role, file, `${path}.properties`);
    geometry(feature.geometry, file, `${path}.geometry`);
    if (!allowed.includes(feature.geometry.type))
      fail(file, `${path}.geometry.type`, `must be ${allowed.join(' or ')} for ${role} data`);
  });
}
