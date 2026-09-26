import { deepFreeze } from '../src/immutable.js';
import districts2002 from './districts-2002.json' with { type: 'json' };
import districts2012 from './districts-2012.json' with { type: 'json' };
import districts2022 from './districts-2022.json' with { type: 'json' };
import type { DistrictProperties, FeatureCollection } from './types.js';

export const districtMaps: Readonly<
  Record<2002 | 2012 | 2022, FeatureCollection<DistrictProperties>>
> = deepFreeze({
  2002: districts2002 as unknown as FeatureCollection<DistrictProperties>,
  2012: districts2012 as unknown as FeatureCollection<DistrictProperties>,
  2022: districts2022 as unknown as FeatureCollection<DistrictProperties>,
});
