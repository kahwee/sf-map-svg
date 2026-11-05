import { createTransitAnimation } from '@kahwee/sf-map-svg/transit';

const map = createTransitAnimation();
document.querySelector('#transit').append(map);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) map.destroy();
});
