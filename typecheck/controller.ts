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
const svg: string = renderMap(guideMapData.map).svg;
void svg;
