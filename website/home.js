import election from '../data/elections/2026-06-02.json';
import { noShareColor, passed, shareColor, yesShare } from './measures-model.js';

const $ = (id) => document.getElementById(id);
const years = [2002, 2012, 2022];
const shortTitles = {
  A: 'Earthquake safety',
  B: 'Lifetime term limits',
  C: 'Business tax decreases',
  D: 'Executive pay tax',
};
const format = new Intl.NumberFormat('en-US');
const pct = (share) => (share === null ? 'No votes' : `${(share * 100).toFixed(2)}%`);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mapCache = new Map();
let measure = election.measures[0];
let mode = 'yes';
let district = 0;
let resultSvg;
let currentYear = 2022;
let currentHistoryLayer;
let activeAnimations = [];
let playbackToken = 0;
let transitionToken = 0;
let playing = false;
let activeTransit;
let activeGuide;

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function loadYear(year) {
  if (!mapCache.has(year)) {
    mapCache.set(
      year,
      fetch(`./maps/districts-${year}.svg`).then(async (response) => {
        if (!response.ok) throw new Error(`Could not load ${year} district map`);
        const documentSvg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        if (documentSvg.querySelector('parsererror'))
          throw new Error(`Invalid ${year} district map`);
        return documentSvg.documentElement;
      }),
    );
  }
  return mapCache.get(year);
}

function cloneMap(source) {
  const svg = document.importNode(source, true);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg;
}

function renderMeasureCards() {
  for (const item of election.measures) {
    const button = element('button', undefined, 'home-measure');
    button.type = 'button';
    button.dataset.measure = item.id;
    button.setAttribute('aria-pressed', String(item.id === measure.id));
    button.append(
      element('span', item.id, 'home-measure-letter'),
      element('span', shortTitles[item.id], 'home-measure-title'),
      element('span', pct(yesShare(item.citywide)), 'home-measure-share'),
    );
    button.addEventListener('click', () => {
      measure = item;
      district = 0;
      updateResults();
    });
    $('home-measures').append(button);
  }
}

function updateResults() {
  $('home-district-select').value = String(district);
  document.querySelector('.map-scale').dataset.mode = mode;
  $('home-result-detail').dataset.mode = mode;
  for (const button of $('home-measures').children)
    button.setAttribute('aria-pressed', String(button.dataset.measure === measure.id));
  for (const button of document.querySelectorAll('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  $('home-map-caption').textContent =
    `Measure ${measure.id} · ${mode === 'yes' ? 'Yes' : 'No'} vote share`;
  $('home-clear-district').hidden = !district;
  if (resultSvg) {
    for (const path of resultSvg.querySelectorAll('[data-layer="district-fills"] path')) {
      const number = Number(path.dataset.district);
      const row = measure.districts.find((item) => item.district === number);
      if (!row) continue;
      const share = yesShare(row);
      path.setAttribute(
        'fill',
        mode === 'yes' ? shareColor(share) : noShareColor(share === null ? null : 1 - share),
      );
      path.setAttribute(
        'aria-label',
        `District ${number}: ${pct(share)} Yes, ${pct(share === null ? null : 1 - share)} No on Measure ${measure.id}`,
      );
      path.setAttribute('aria-pressed', String(number === district));
      path.classList.toggle('is-selected', number === district);
    }
  }
  const row = district
    ? measure.districts.find((item) => item.district === district)
    : measure.citywide;
  const share = yesShare(row);
  const viewedShare = mode === 'yes' ? share : share === null ? null : 1 - share;
  const title = element('h3', district ? `District ${district}` : 'All San Francisco');
  const label = element('p', `Measure ${measure.id} · ${shortTitles[measure.id]}`, 'result-label');
  const percentage = element(
    'p',
    `${pct(viewedShare)} ${mode === 'yes' ? 'Yes' : 'No'}`,
    'result-big',
  );
  const outcome = element(
    'p',
    passed(measure) ? 'Passed citywide' : 'Did not pass citywide',
    'result-outcome',
  );
  const bar = element('div', undefined, 'result-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = element('span');
  fill.style.width = `${(viewedShare ?? 0) * 100}%`;
  bar.append(fill);
  const counts = element(
    'p',
    `${format.format(row.yes)} Yes · ${format.format(row.no)} No`,
    'result-counts',
  );
  const note = element(
    'p',
    district
      ? 'District share; passage is citywide.'
      : `${measure.threshold === 'two-thirds' ? 'Two-thirds' : 'Majority'} required to pass.`,
    'result-note',
  );
  $('home-result-detail').replaceChildren(label, title, percentage, outcome, bar, counts, note);
}

async function initResults() {
  try {
    const svg = cloneMap(await loadYear(2022));
    svg.setAttribute('role', 'group');
    svg.setAttribute(
      'aria-label',
      '2022 district map. Select a district to inspect its ballot measure results.',
    );
    svg.querySelector('title').textContent = 'San Francisco district ballot measure results';
    for (const path of svg.querySelectorAll('[data-layer="district-fills"] path')) {
      const number = Number(path.dataset.district);
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.addEventListener('click', () => {
        district = number;
        updateResults();
      });
      path.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          district = number;
          updateResults();
        }
      });
    }
    resultSvg = svg;
    $('home-results-map').replaceChildren(svg);
    updateResults();
  } catch (error) {
    $('home-results-map').textContent =
      'The district map could not load. Open the full atlas to explore results.';
    console.error(error);
  }
}

function historyLayer(source) {
  const layer = element('div', undefined, 'history-layer');
  const svg = cloneMap(source);
  svg.setAttribute('aria-hidden', 'true');
  layer.append(svg);
  return layer;
}

function updateHistoryLabel() {
  $('history-year').textContent = String(currentYear);
  $('history-status').textContent = `Showing ${currentYear} boundaries`;
  $('history-map').setAttribute(
    'aria-label',
    `${currentYear} San Francisco supervisorial districts`,
  );
  for (const button of document.querySelectorAll('[data-year]'))
    button.setAttribute('aria-pressed', String(Number(button.dataset.year) === currentYear));
}

async function transitionToYear(year, animate = true) {
  if (!years.includes(year)) return false;
  const request = ++transitionToken;
  const source = await loadYear(year);
  if (request !== transitionToken) return false;
  if (year === currentYear && currentHistoryLayer) return true;
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations = [];
  const next = historyLayer(source);
  if (!currentHistoryLayer || !animate || reducedMotion.matches) {
    $('history-map').replaceChildren(next);
    currentHistoryLayer = next;
    currentYear = year;
    updateHistoryLabel();
    return true;
  }
  $('history-status').textContent = `Drawing ${year} boundaries`;
  $('history-map').append(next);
  const outlines = [...next.querySelectorAll('[data-layer="district-lines"] path')];
  const animations = [
    next.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 500,
      easing: 'ease-out',
      fill: 'forwards',
    }),
  ];
  for (const [index, path] of outlines.entries()) {
    const length = Math.max(1, path.getTotalLength());
    path.style.strokeDasharray = `${length}px ${length}px`;
    path.style.strokeDashoffset = `${length}px`;
    path.style.stroke = '#216c70';
    path.style.strokeWidth = '2.4px';
    path.style.strokeLinecap = 'round';
    animations.push(
      path.animate([{ strokeDashoffset: `${length}px` }, { strokeDashoffset: '0px' }], {
        duration: 1100,
        delay: 160 + index * 55,
        easing: 'cubic-bezier(.42, 0, .24, 1)',
        fill: 'forwards',
      }),
    );
  }
  activeAnimations = animations;
  try {
    await Promise.all(animations.map((animation) => animation.finished));
  } catch {
    next.remove();
    if (request === transitionToken) updateHistoryLabel();
    return false;
  }
  if (activeAnimations === animations) activeAnimations = [];
  for (const animation of animations) animation.cancel();
  for (const path of outlines) {
    path.style.removeProperty('stroke-dasharray');
    path.style.removeProperty('stroke-dashoffset');
    path.style.removeProperty('stroke');
    path.style.removeProperty('stroke-width');
    path.style.removeProperty('stroke-linecap');
  }
  $('history-map').replaceChildren(next);
  currentHistoryLayer = next;
  currentYear = year;
  updateHistoryLabel();
  return true;
}

function stopPlayback() {
  playbackToken++;
  transitionToken++;
  playing = false;
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations = [];
  $('history-play').textContent = 'Play the change ▶';
  $('history-play').setAttribute('aria-label', 'Play district boundary history');
}

function wait(ms, token) {
  return new Promise((resolve) => setTimeout(() => resolve(token === playbackToken), ms));
}

async function playHistory() {
  if (playing) {
    stopPlayback();
    return;
  }
  playing = true;
  const token = ++playbackToken;
  $('history-play').textContent = 'Pause playback';
  $('history-play').setAttribute('aria-label', 'Pause district boundary history');
  try {
    await transitionToYear(2002, false);
    for (const year of [2012, 2022]) {
      if (!(await wait(reducedMotion.matches ? 300 : 650, token))) return;
      if (!(await transitionToYear(year)) || token !== playbackToken) return;
    }
  } catch (error) {
    $('history-status').textContent = 'District history could not load';
    console.error(error);
  } finally {
    if (token === playbackToken) stopPlayback();
  }
}

async function initHistory() {
  try {
    await transitionToYear(2022, false);
  } catch (error) {
    $('history-map').textContent = 'District history could not load.';
    $('history-play').disabled = true;
    console.error(error);
  }
}

renderMeasureCards();
for (let number = 1; number <= 11; number++)
  $('home-district-select').add(new Option(`District ${number}`, String(number)));
$('home-district-select').addEventListener('change', (event) => {
  district = Number(event.target.value);
  updateResults();
});
updateResults();
initResults();
initHistory();
for (const button of document.querySelectorAll('[data-mode]'))
  button.addEventListener('click', () => {
    mode = button.dataset.mode;
    updateResults();
  });
$('home-clear-district').addEventListener('click', () => {
  district = 0;
  updateResults();
});
for (const button of document.querySelectorAll('[data-year]'))
  button.addEventListener('click', async () => {
    stopPlayback();
    try {
      await transitionToYear(Number(button.dataset.year));
    } catch (error) {
      $('history-status').textContent = 'District map could not load';
      console.error(error);
    }
  });
$('history-play').addEventListener('click', playHistory);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPlayback();
});
$('load-transit').addEventListener('click', async () => {
  const button = $('load-transit');
  button.disabled = true;
  button.textContent = 'Loading journey…';
  try {
    const { createTransitAnimation } = await import('@kahwee/sf-map-svg/transit');
    activeTransit = createTransitAnimation();
    $('transit-preview').replaceChildren(activeTransit);
    activeTransit.shadowRoot.querySelector('button').click();
    button.hidden = true;
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Try loading the journey again';
    console.error(error);
  }
});
$('load-guide').addEventListener('click', async () => {
  const button = $('load-guide');
  button.disabled = true;
  $('guide-mount').hidden = false;
  try {
    const { createGuideMap } = await import('@kahwee/sf-map-svg/guide');
    activeGuide = createGuideMap();
    $('guide-mount').replaceChildren(activeGuide);
    button.hidden = true;
  } catch (error) {
    button.disabled = false;
    $('guide-loading').textContent = 'The guide map could not load. Try again.';
    console.error(error);
  }
});
$('copy-install').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('install-command').textContent);
    $('copy-status').textContent = 'Install command copied.';
  } catch {
    $('copy-status').textContent = 'Select and copy the install command above.';
  }
});
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  stopPlayback();
  activeTransit?.destroy();
  activeGuide?.destroy();
});
