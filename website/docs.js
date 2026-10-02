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

// API reference: filter table rows and sections as you type. "/" focuses, Escape clears.
const search = document.querySelector('.api-search');
const filter = document.getElementById('api-filter');
if (search && filter) {
  search.hidden = false;
  const count = document.getElementById('api-count');
  const empty = document.querySelector('.api-empty');
  const entries = [...document.querySelectorAll('.api-entry')].map((section) => ({
    section,
    title: section.querySelector('h2')?.textContent.toLowerCase() ?? '',
    rows: [...section.querySelectorAll('tbody tr')].map((row) => ({
      row,
      text: row.textContent.toLowerCase(),
    })),
    text: section.textContent.toLowerCase(),
  }));
  const run = () => {
    const terms = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (text) => terms.every((term) => text.includes(term));
    let total = 0;
    for (const entry of entries) {
      const titled = terms.length > 0 && matches(entry.title);
      let shown = 0;
      for (const { row, text } of entry.rows) {
        const hit = !terms.length || titled || matches(text);
        row.hidden = !hit;
        if (hit && terms.length) shown += 1;
      }
      const hit =
        !terms.length || titled || shown > 0 || (!entry.rows.length && matches(entry.text));
      entry.section.hidden = !hit;
      total += terms.length && hit ? Math.max(shown, 1) : 0;
    }
    if (empty) empty.hidden = !terms.length || total > 0;
    if (count) count.textContent = terms.length ? `${total} match${total === 1 ? '' : 'es'}` : '';
  };
  filter.addEventListener('input', run);
  addEventListener('keydown', (event) => {
    const typing =
      event.target instanceof HTMLElement && event.target.matches('input, textarea, select');
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      filter.focus();
    } else if (event.key === 'Escape' && document.activeElement === filter) {
      filter.value = '';
      run();
      filter.blur();
    }
  });
}
