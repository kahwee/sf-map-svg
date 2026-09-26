import { createNeighborhoodExplorer } from '@kahwee/sf-map-svg/explorer';

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

const copy = document.querySelector('#copy-install');
copy.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#install-command').textContent);
    status.textContent = 'Install command copied.';
  } catch {
    status.textContent = 'Select and copy the install command above.';
  }
});
