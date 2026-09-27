const mount = document.querySelector('#spot-mount');
const load = async () => {
  try {
    const { mountSpotExplorer } = await import('./spot-explorer.js');
    mountSpotExplorer(mount);
  } catch {
    mount.querySelector('.spot-loading').textContent =
      'The map could not load. Please refresh to try again.';
  }
};

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      load();
    },
    { rootMargin: '400px' },
  );
  observer.observe(mount);
} else {
  load();
}
