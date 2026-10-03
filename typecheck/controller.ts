import { createMap, type MapOptions, renderMap } from '@kahwee/sf-map-svg';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';

const options: MapOptions = {
  features: { motion: true },
  appearance: { colors: { water: '#fff' } },
};
const map = createMap(guideMapData, options);
document.body.append(map.element);
map.configure({ features: { motion: false }, controls: { pan: false } });
map.camera.reset({ animate: false });
map.camera.fit({ type: 'Point', coordinates: [-122.4, 37.7] }, { padding: 20, duration: 100 });
map.on('markerchange', ({ marker }) => marker?.label);
// @ts-expect-error No untyped event names.
map.on('click', () => {});
// @ts-expect-error Features have a single grouped home.
createMap(guideMapData, { motion: true });
// @ts-expect-error Controller is not a DOM node.
document.body.append(map);
map.setMode('basemap', { resetView: false });
map.setSource('realtor', { resetView: false });
map.selectFeature({ kind: 'neighborhood', source: 'realtor', id: 'inner-mission' });
map.selectFeature({ kind: 'district', year: 2022, id: 1 });
// @ts-expect-error Neighborhood identity requires its source.
map.selectFeature({ kind: 'neighborhood', id: 'inner-mission' });
// @ts-expect-error District identity requires a numeric ID.
map.selectFeature({ kind: 'district', year: 2022, id: '1' });
const source: string = map.getConfiguration().source;
void source;
const svg: string = renderMap(guideMapData, { source: 'realtor' }).svg;
void svg;
