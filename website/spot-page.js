import { whenVisible } from './motion-kit.js';
import { loadSiteMapData } from './site-map-data.js';

const mount = document.querySelector('#spot-mount');
whenVisible(
  mount,
  async () => {
    try {
      const [{ mountSpotExplorer }, data] = await Promise.all([
        import('./spot-explorer.js'),
        loadSiteMapData(),
      ]);
      mountSpotExplorer(mount, { data });
    } catch (error) {
      mount.querySelector('.stage-loading').textContent =
        'The map could not load. Please refresh to try again.';
      console.error(error);
    }
  },
  '400px',
);
