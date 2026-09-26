import { createTransitAnimation } from '../src/transit.ts';

const map = createTransitAnimation();
document.querySelector('#transit').append(map);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) map.destroy();
});
