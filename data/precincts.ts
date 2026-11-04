import { deepFreeze } from '../src/immutable.js';
import precincts2022 from './precincts-2022.json' with { type: 'json' };
import type { FeatureCollection, PrecinctProperties } from './types.js';

export const precinctMaps: Readonly<Record<2022, FeatureCollection<PrecinctProperties>>> =
  deepFreeze({
    2022: precincts2022 as unknown as FeatureCollection<PrecinctProperties>,
  });
