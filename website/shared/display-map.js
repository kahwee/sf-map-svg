// @ts-check
// Prebuilt district maps for on-screen display. scripts/build/pages.mjs writes
// them with display-only simplification, so pages avoid bundling raw GeoJSON.
import { createAsyncCache } from './async-cache.js';

/** @param {string} key */
async function fetchDisplayMap(key) {
  const response = await fetch(`./maps/${key}.svg`);
  if (!response.ok) throw new Error(`Could not load ${key} district map`);
  const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  if (parsed.getElementsByTagName('parsererror').length)
    throw new Error(`Invalid ${key} district map`);
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg')
    throw new Error(`Invalid ${key} district map`);
  return /** @type {SVGSVGElement} */ (/** @type {unknown} */ (svg));
}
const load = createAsyncCache(fetchDisplayMap);

/** Load a pre-rendered district map (`display` or small `thumb`) as a detached <svg>.
 * @param {number} year
 * @param {string} [size]
 */
export function loadDisplayMap(year, size = 'display') {
  return load(`${size}/districts-${year}`);
}

/** A fresh, sizable copy of a display map for insertion into the page.
 * @param {number} year
 * @param {{idPrefix?: string, title?: string, size?: string}} [options]
 */
export async function displayMapCopy(year, { idPrefix, title, size = 'display' } = {}) {
  const svg = document.importNode(await loadDisplayMap(year, size), true);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  if (idPrefix) {
    // Keep ids unique if a page shows more than one copy.
    const from = `districts-${year}`;
    for (const node of svg.querySelectorAll('[id]')) node.id = node.id.replace(from, idPrefix);
    for (const node of svg.querySelectorAll('[clip-path]'))
      node.setAttribute(
        'clip-path',
        (node.getAttribute('clip-path') ?? '').replace(from, idPrefix),
      );
    svg.setAttribute(
      'aria-labelledby',
      (svg.getAttribute('aria-labelledby') ?? '').replace(from, idPrefix),
    );
  }
  const titleNode = svg.querySelector('title');
  if (title && titleNode) titleNode.textContent = title;
  return svg;
}
