import { createGuideMap } from '@kahwee/sf-map-svg/guide';

const host = document.querySelector('#explorer');
const fullExplorerButton = document.querySelector('#load-full-explorer');
let activeMap;

try {
  activeMap = createGuideMap();
  host.replaceChildren(activeMap);
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) activeMap?.destroy();
  });
} catch (error) {
  document.querySelector('#loading').textContent =
    'The guide map could not load. You can still open the SVG maps below.';
  console.error(error);
}

fullExplorerButton.addEventListener('click', async () => {
  fullExplorerButton.disabled = true;
  fullExplorerButton.textContent = 'Loading the full explorer…';
  try {
    const { createNeighborhoodExplorer } = await import('@kahwee/sf-map-svg/explorer');
    activeMap?.destroy();
    activeMap = createNeighborhoodExplorer();
    host.replaceChildren(activeMap);
    fullExplorerButton.hidden = true;
  } catch (error) {
    fullExplorerButton.disabled = false;
    fullExplorerButton.textContent = 'Try loading the full explorer again';
    console.error(error);
  }
});

const transitButton = document.querySelector('#load-transit');
transitButton.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src = './transit.html';
  frame.title = 'Interactive schematic BART animation';
  frame.loading = 'lazy';
  frame.className = 'transit-frame';
  document.querySelector('#transit-frame-mount').replaceChildren(frame);
  transitButton.hidden = true;
});

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
