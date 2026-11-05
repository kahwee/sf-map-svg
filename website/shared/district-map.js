// A selectable district choropleth for the example pages. It uses the build's pre-rendered
// display SVG (renderMap output), paints fills, and morphs outlines between map years.
import { displayMapCopy } from './display-map.js';
import { createDistrictMorph } from './district-morph.ts';
import { growMap, prefersReducedMotion } from './motion-kit.js';

const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * `label(id)` returns each district's accessible name; `onSelect(id)` runs on click, Enter,
 * or Space. Call `paint(styleFor)` with a function from district id to { fill }.
 */
export async function createDistrictMap(host, { year, idPrefix, title, label, onSelect }) {
  let current = year;
  let revision = 0;
  let styleFor = () => ({});
  let selected = 0;
  let morphFrame = 0;
  host.classList.add('district-map', 'choropleth', 'map-surface');

  const layerFor = async (mapYear) => {
    const svg = await displayMapCopy(mapYear, { idPrefix: `${idPrefix}-${mapYear}`, title });
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', `${title}, ${mapYear} supervisorial districts`);
    for (const path of svg.querySelectorAll('[data-layer="district-fills"] path')) {
      const id = Number(path.dataset.district);
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.addEventListener('click', () => onSelect?.(id));
      path.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.(id);
        }
      });
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'district-map-layer';
    wrapper.append(svg);
    return wrapper;
  };

  function apply(layer = host.querySelector('.district-map-layer:last-of-type')) {
    if (!layer) return;
    for (const path of layer.querySelectorAll('[data-layer="district-fills"] path')) {
      const id = Number(path.dataset.district);
      const style = styleFor(id) ?? {};
      if (style.fill) path.setAttribute('fill', style.fill);
      path.setAttribute('aria-label', label?.(id) ?? `District ${id}`);
      path.setAttribute('aria-pressed', String(id === selected));
      path.classList.toggle('is-selected', id === selected);
    }
    for (const path of layer.querySelectorAll('[data-layer="district-lines"] path'))
      path.classList.toggle('is-selected', Number(path.dataset.district) === selected);
  }

  const first = await layerFor(year);
  host.replaceChildren(first);
  growMap(host);

  return {
    get year() {
      return current;
    },
    paint(next) {
      styleFor = next;
      apply();
    },
    select(id) {
      selected = id;
      apply();
    },
    /** Morph to another district map year, keeping the same fills and selection. */
    async setYear(next) {
      if (next === current) return;
      const request = ++revision;
      const from = host.querySelector('.district-map-layer:last-of-type');
      const to = await layerFor(next);
      if (request !== revision) return;
      cancelAnimationFrame(morphFrame);
      for (const stale of host.querySelectorAll('.district-map-layer, .district-morph'))
        if (stale !== from) stale.remove();
      current = next;
      apply(to);
      if (!from || prefersReducedMotion()) {
        host.replaceChildren(to);
        return;
      }
      const morph = createDistrictMorph(from.querySelector('svg'), to.querySelector('svg'));
      morph.layer.classList.add('district-morph');
      const lines = to.querySelector('[data-layer="district-lines"]');
      to.style.opacity = '0';
      lines.style.opacity = '0';
      host.append(to, morph.layer);
      let start;
      await new Promise((resolve) => {
        const tick = (time) => {
          if (request !== revision) return resolve();
          start ??= time;
          const progress = Math.min(1, (time - start) / 1400);
          morph.update(ease(progress));
          to.style.opacity = String(Math.min(1, progress / 0.7));
          const settle = Math.max(0, (progress - 0.75) / 0.25);
          lines.style.opacity = String(settle);
          morph.setOpacity(1 - settle);
          if (progress < 1) morphFrame = requestAnimationFrame(tick);
          else resolve();
        };
        morphFrame = requestAnimationFrame(tick);
      });
      if (request !== revision) return;
      to.style.removeProperty('opacity');
      lines.style.removeProperty('opacity');
      host.replaceChildren(to);
    },
    /** A standalone copy of the current map, for downloads. */
    snapshot() {
      const svg = host.querySelector('.district-map-layer:last-of-type svg')?.cloneNode(true);
      if (!svg) return '';
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      for (const node of svg.querySelectorAll('[tabindex], [role], [aria-pressed]')) {
        node.removeAttribute('tabindex');
        node.removeAttribute('role');
        node.removeAttribute('aria-pressed');
      }
      return new XMLSerializer().serializeToString(svg);
    },
  };
}
