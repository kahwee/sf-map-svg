// Docs and API reference: highlight code, and track the current section in the contents.
import { enhanceCode } from './ui.js';

enhanceCode();

const links = new Map(
  [...document.querySelectorAll('.toc a[href^="#"]')].map((link) => [
    link.getAttribute('href').slice(1),
    link,
  ]),
);
const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
if (sections.length && 'IntersectionObserver' in window) {
  const visible = new Set();
  const update = () => {
    const current = sections.find((section) => visible.has(section)) ?? null;
    for (const [id, link] of links) link.setAttribute('aria-current', String(current?.id === id));
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      update();
    },
    { rootMargin: '-20% 0px -65% 0px' },
  );
  for (const section of sections) observer.observe(section);
}
