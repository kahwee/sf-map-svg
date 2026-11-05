// Prebuilt district maps for on-screen display. scripts/build-pages.mjs writes
// them with display-only simplification, so pages avoid bundling raw GeoJSON.
const cache = new Map();

/** Load a pre-rendered district map (`display` or small `thumb`) as a detached <svg>. */
export function loadDisplayMap(year, size = 'display') {
  const key = `${size}-${year}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`./maps/${size}/districts-${year}.svg`).then(async (response) => {
        if (!response.ok) throw new Error(`Could not load ${year} district map`);
        const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        if (parsed.querySelector('parsererror')) throw new Error(`Invalid ${year} district map`);
        return parsed.documentElement;
      }),
    );
  }
  return cache.get(key);
}

/** A fresh, sizable copy of a display map for insertion into the page. */
export async function displayMapCopy(year, { idPrefix, title, size = 'display' } = {}) {
  const svg = document.importNode(await loadDisplayMap(year, size), true);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  if (idPrefix) {
    // Keep ids unique if a page shows more than one copy.
    const from = `districts-${year}`;
    for (const node of svg.querySelectorAll('[id]')) node.id = node.id.replace(from, idPrefix);
    for (const node of svg.querySelectorAll('[clip-path]'))
      node.setAttribute('clip-path', node.getAttribute('clip-path').replace(from, idPrefix));
    svg.setAttribute(
      'aria-labelledby',
      svg.getAttribute('aria-labelledby').replace(from, idPrefix),
    );
  }
  if (title) svg.querySelector('title').textContent = title;
  return svg;
}
