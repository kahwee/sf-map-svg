// JSON files are the single source of geographic truth. This adapter preserves
// the renderer's compact internal shape and its original source display names.
import coast from '../data/coast.json' with { type: 'json' };
import districts2002 from '../data/districts-2002.json' with { type: 'json' };
import districts2012 from '../data/districts-2012.json' with { type: 'json' };
import districts2022 from '../data/districts-2022.json' with { type: 'json' };
import neighborhoods from '../data/neighborhoods-realtor.json' with { type: 'json' };
import highways from '../data/highways.json' with { type: 'json' };
import { deepFreeze } from './immutable.js';

const districtRows = (collection) =>
  collection.features.map(({ geometry, properties }) => ({
    id: properties.district,
    label: properties.label,
    labelPoints: properties.labelPoints,
    geometry,
    extras: properties.displayExtras,
  }));

export default deepFreeze({
  coast: coast.features[0].geometry,
  districts: {
    2002: districtRows(districts2002),
    2012: districtRows(districts2012),
    2022: districtRows(districts2022),
  },
  neighborhoods: neighborhoods.features.map(({ geometry, properties }) => ({
    name: properties.sourceName,
    geometry,
  })),
  highways: highways.features.map(({ geometry, properties }) => ({
    route: properties.route,
    geometry,
  })),
});
