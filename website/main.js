import { createNeighborhoodExplorer } from '../src/explorer.ts';

const host = document.querySelector('#explorer');
try {
  const explorer = createNeighborhoodExplorer();
  host.replaceChildren(explorer);
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) explorer.destroy();
  });
} catch (error) {
  document.querySelector('#loading').textContent =
    'The interactive map could not load. You can still open the SVG maps below.';
  console.error(error);
}
