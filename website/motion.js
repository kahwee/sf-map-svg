// Site-wide motion: theme toggle wipe and below-the-fold reveals.
// boot.js (inlined in <head>) applies the saved theme and names shared titles.
import { isBelowFold, prefersReducedMotion } from './motion-kit.js';

const root = document.documentElement;
const THEME_KEY = 'sf-theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

// ---------- Theme ----------
const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

function applyTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable; the choice then lasts for this page only.
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
    meta.content = theme === 'dark' ? '#0e1a1a' : '#f8f8f2';
  const pending = syncToggle();
  root.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  return pending;
}

const toggle = document.querySelector('.theme-toggle');
function syncToggle() {
  toggle?.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  return syncImages();
}

/**
 * Map images carry a dark twin in data-dark-src. Returns decode promises for
 * swapped images on screen, so a theme wipe can wait for them.
 */
function syncImages() {
  const dark = currentTheme() === 'dark';
  const pending = [];
  for (const image of document.querySelectorAll('img[data-dark-src]')) {
    image.dataset.lightSrc ??= image.getAttribute('src');
    const source = dark ? image.dataset.darkSrc : image.dataset.lightSrc;
    if (image.getAttribute('src') === source) continue;
    image.setAttribute('src', source);
    const box = image.getBoundingClientRect();
    if (box.bottom > 0 && box.top < innerHeight) pending.push(image.decode().catch(() => {}));
  }
  return pending;
}

toggle?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || prefersReducedMotion()) {
    applyTheme(next);
    return;
  }
  const box = toggle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('theme-wiping');
  const transition = document.startViewTransition(async () => {
    await Promise.all(applyTheme(next));
  });
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 760,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove('theme-wiping'));
});
darkQuery.addEventListener('change', () => {
  if (!root.dataset.theme) syncToggle();
});
syncToggle();

// ---------- Reveals: hide only what starts below the fold ----------
function setupReveals() {
  const targets = document.querySelectorAll('[data-reveal], [data-rule]');
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.classList.remove('is-pending');
        entry.target.classList.add('is-in');
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const target of targets) {
    if (target.dataset.reveal === 'stagger') {
      [...target.children].forEach((child, index) => {
        child.style.setProperty('--i', String(index));
      });
    }
    if (!isBelowFold(target)) continue;
    target.classList.add('is-pending');
    observer.observe(target);
  }
}
setupReveals();

// ---------- Scroll progress only where there is something to scroll ----------
const markScrollable = () =>
  root.classList.toggle('can-scroll', root.scrollHeight > innerHeight + 40);
new ResizeObserver(markScrollable).observe(document.body);
addEventListener('resize', markScrollable);
