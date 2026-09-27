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
  syncToggle();
  root.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

const toggle = document.querySelector('.theme-toggle');
function syncToggle() {
  toggle?.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
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
  const transition = document.startViewTransition(() => applyTheme(next));
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
