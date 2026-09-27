// Inlined into every page's <head> by scripts/build-pages.mjs. It must run
// before first paint: it applies the saved theme without a flash and names the
// shared title for cross-document View Transitions (pagereveal fires before
// deferred module scripts run).
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  try {
    const theme = localStorage.getItem('sf-theme');
    if (theme === 'dark' || theme === 'light') {
      root.dataset.theme = theme;
      // An explicit choice overrides the system-matched browser bar color.
      const color = theme === 'dark' ? '#0e1a1a' : '#f8f8f2';
      for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
        meta.content = color;
    }
  } catch {
    // Storage can be unavailable; the system theme then applies.
  }

  const pageKey = (url) => new URL(url, location.href).pathname.replace(/index\.html$/, '');
  const inView = (element) => {
    const box = element?.getBoundingClientRect();
    return Boolean(box && box.bottom > 0 && box.top < innerHeight && box.width > 0);
  };
  const cardTitleFor = (url) => {
    if (!url) return undefined;
    const key = pageKey(url);
    for (const card of document.querySelectorAll('[data-vt-card]')) {
      const href = card.getAttribute('href') || card.querySelector('a[href]')?.getAttribute('href');
      if (!href || new URL(href, location.href).hash || pageKey(href) !== key) continue;
      const title = card.querySelector('h2, h3');
      if (inView(title)) return title;
    }
    return undefined;
  };
  const pageTitle = () => {
    const title = document.querySelector('[data-vt-title]');
    return inView(title) ? title : undefined;
  };
  const name = (element, transition) => {
    if (!element || !transition) return;
    element.style.viewTransitionName = 'page-title';
    element.classList.add('vt-shared');
    transition.finished.finally(() => {
      element.style.removeProperty('view-transition-name');
      element.classList.remove('vt-shared');
    });
  };
  // Leaving: the card that points at the destination, else this page's title.
  addEventListener('pageswap', (event) => {
    if (event.viewTransition)
      name(cardTitleFor(event.activation?.entry?.url) || pageTitle(), event.viewTransition);
  });
  // Arriving: the card for the page we came from, else this page's title.
  addEventListener('pagereveal', (event) => {
    if (event.viewTransition)
      name(
        cardTitleFor(globalThis.navigation?.activation?.from?.url) || pageTitle(),
        event.viewTransition,
      );
  });
})();
