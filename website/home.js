import election from '../data/elections/2026-06-02.json';
import { createDistrictMorph } from './district-morph.ts';
import { createHeroField } from './hero-field.js';
import { noShareColor, passed, shareColor, yesShare } from './measures-model.js';
import { countTo, growMap, replay, staggerChildren } from './motion-kit.js';

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
let activeTransition;
let playbackToken = 0;
let transitionToken = 0;
let playing = false;
let activeTransit;
let activeGuide;
let shownShare = 0;

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
  const previousShare = shownShare;
  const side = mode === 'yes' ? 'Yes' : 'No';
  const percentage = element('p', undefined, 'result-big');
  const counter = element('span');
  counter.setAttribute('aria-hidden', 'true');
  percentage.append(element('span', `${pct(viewedShare)} ${side}`, 'sr-only'), counter);
  if (viewedShare === null) counter.textContent = `${pct(null)} ${side}`;
  else
    countTo(counter, viewedShare * 100, {
      from: previousShare * 100,
      duration: 650,
      format: (value) => `${value.toFixed(2)}% ${side}`,
    });
  shownShare = viewedShare ?? 0;
  const outcome = element(
    'p',
    passed(measure) ? 'Passed citywide' : 'Did not pass citywide',
    'result-outcome',
  );
  const bar = element('div', undefined, 'result-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = element('span', undefined, 'grow-bar');
  fill.style.setProperty('--v', String(viewedShare ?? 0));
  fill.style.setProperty('--from', String(previousShare));
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
  staggerChildren($('home-result-detail'));
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
    growMap($('home-results-map'));
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
  if ($('history-year').textContent !== String(currentYear)) replay($('history-year'));
  $('history-year').textContent = String(currentYear);
  $('history-status').textContent = `Showing ${currentYear} boundaries`;
  $('history-map').setAttribute(
    'aria-label',
    `${currentYear} San Francisco supervisorial districts`,
  );
  for (const button of document.querySelectorAll('.history-timeline button[data-year]'))
    button.setAttribute('aria-pressed', String(Number(button.dataset.year) === currentYear));
}

async function transitionToYear(year, animate = true) {
  if (!years.includes(year)) return false;
  const request = ++transitionToken;
  const source = await loadYear(year);
  if (request !== transitionToken) return false;
  activeTransition?.cancel();
  activeTransition = undefined;
  if (year === currentYear && currentHistoryLayer) {
    updateHistoryLabel();
    return true;
  }
  const next = historyLayer(source);
  if (!currentHistoryLayer || !animate || reducedMotion.matches) {
    $('history-map').replaceChildren(next);
    currentHistoryLayer = next;
    currentYear = year;
    updateHistoryLabel();
    return true;
  }
  const fromLines = currentHistoryLayer.querySelector('[data-layer="district-lines"]');
  const toLines = next.querySelector('[data-layer="district-lines"]');
  const fromLabels = currentHistoryLayer.querySelector('[data-layer="district-labels"]');
  const toLabels = next.querySelector('[data-layer="district-labels"]');
  const morph = createDistrictMorph(
    currentHistoryLayer.querySelector('svg'),
    next.querySelector('svg'),
  );
  $('history-status').textContent = `Morphing ${currentYear} into ${year} boundaries`;
  fromLines.style.opacity = '0';
  toLines.style.opacity = '0';
  toLabels.style.opacity = '0';
  next.style.opacity = '0';
  morph.update(0);
  $('history-map').append(next, morph.layer);
  const completed = await new Promise((resolve) => {
    let frame;
    let settled = false;
    let started;
    let transition;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(frame);
      if (activeTransition === transition) activeTransition = undefined;
      fromLines.style.removeProperty('opacity');
      toLines.style.removeProperty('opacity');
      fromLabels.style.removeProperty('opacity');
      toLabels.style.removeProperty('opacity');
      next.style.removeProperty('opacity');
      morph.layer.remove();
      if (!value) next.remove();
      resolve(value);
    };
    transition = { cancel: () => finish(false) };
    activeTransition = transition;
    const tick = (time) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / 1550);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      morph.update(eased);
      next.style.opacity = String(Math.min(1, progress / 0.75));
      fromLabels.style.opacity = String(Math.max(0, 1 - progress / 0.35));
      toLabels.style.opacity = String(Math.max(0, (progress - 0.65) / 0.35));
      const settling = Math.max(0, (progress - 0.75) / 0.25);
      toLines.style.opacity = String(settling);
      morph.setOpacity(1 - settling);
      if (progress === 1) finish(true);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
  if (!completed) {
    if (request === transitionToken) updateHistoryLabel();
    return false;
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
  activeTransition?.cancel();
  activeTransition = undefined;
  updateHistoryLabel();
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

const heroArt = document.querySelector('.hero-art');
loadYear(2022)
  .then((svg) => createHeroField(heroArt, svg))
  .catch((error) => {
    heroArt.classList.add('is-fallback');
    console.error(error);
  });
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
