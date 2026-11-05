// Animated plates: pre-rendered by renderMap({ animation }) at build time and inlined when
// they scroll into view, so they draw themselves while visible. Without JavaScript the
// <noscript> image shows the finished map. Inline maps follow the theme's water via CSS.
import { whenVisible } from './motion-kit.js';

const cache = new Map();
const load = (url) => {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.text();
      }),
    );
  return cache.get(url);
};

let sequence = 0;
/** Give each inlined copy unique ids and animation scope, so a replay restarts cleanly. */
function unique(markup) {
  const scope = markup.match(/data-sf-animate="([^"]+)"/)?.[1];
  if (!scope) return markup;
  return markup.replaceAll(scope, `${scope}-${++sequence}`);
}

async function draw(host) {
  const markup = await load(host.dataset.plate);
  const holder = document.createElement('div');
  holder.innerHTML = unique(markup);
  const svg = holder.querySelector('svg');
  if (!svg) return;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  host.querySelector('svg')?.remove();
  host.querySelector('.plate-loading')?.remove();
  host.prepend(svg);
}

/** Inline every [data-plate] when it first nears the viewport; wire any replay button. */
export function mountPlates(root = document) {
  for (const host of root.querySelectorAll('[data-plate]')) {
    if (host.dataset.plateMounted) continue;
    host.dataset.plateMounted = '';
    whenVisible(host, () => draw(host).catch(() => host.classList.add('plate-failed')), '120px');
    host
      .querySelector('.plate-replay')
      ?.addEventListener('click', () => draw(host).catch(() => {}));
  }
}
