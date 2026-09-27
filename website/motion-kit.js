// Small motion helpers shared by the site entry and page scripts.
// No library: IntersectionObserver and requestAnimationFrame cover these cases.

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedQuery.matches;

const expoOut = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

/** Run `callback` once when `target` first scrolls into view. */
export function whenVisible(target, callback, rootMargin = '0px 0px -10% 0px') {
  if (!('IntersectionObserver' in window)) {
    callback();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      callback();
    },
    { rootMargin },
  );
  observer.observe(target);
  return () => observer.disconnect();
}

/** True when the element starts below the current viewport. */
export function isBelowFold(target) {
  return target.getBoundingClientRect().top > innerHeight;
}

/**
 * Count a number up in `target`. The final text is written to `label` first so
 * assistive technology never hears the intermediate values.
 */
export function countTo(target, to, { from = 0, duration = 700, format = String } = {}) {
  cancelAnimationFrame(Number(target.dataset.countFrame));
  if (prefersReducedMotion() || from === to) {
    target.textContent = format(to);
    return;
  }
  let start;
  const step = (time) => {
    start ??= time;
    const progress = Math.min(1, (time - start) / duration);
    target.textContent = format(from + (to - from) * expoOut(progress));
    if (progress < 1) target.dataset.countFrame = String(requestAnimationFrame(step));
  };
  target.dataset.countFrame = String(requestAnimationFrame(step));
}

/** Grow a district map's shapes in, in district order, once it is visible. */
export function growMap(container) {
  if (prefersReducedMotion()) return;
  const svg = container.querySelector('svg');
  if (!svg) return;
  for (const path of svg.querySelectorAll('[data-layer="district-fills"] path')) {
    path.style.setProperty('--i', path.dataset.district || '0');
  }
  container.classList.add('map-wait');
  whenVisible(container, () => {
    container.classList.remove('map-wait');
    container.classList.add('map-grow');
    setTimeout(() => container.classList.remove('map-grow'), 1600);
  });
}

/** Stagger the children of a freshly replaced container. */
export function staggerChildren(container) {
  if (prefersReducedMotion()) return;
  [...container.children].forEach((child, index) => {
    child.style.setProperty('--i', String(index));
  });
  container.classList.remove('swap-in');
  void container.offsetWidth;
  container.classList.add('swap-in');
}

/** Restart a one-shot keyframe class on an element. */
export function replay(target, className = 'tick') {
  if (prefersReducedMotion()) return;
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
}
