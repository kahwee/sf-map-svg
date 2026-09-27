// Hero signature: San Francisco as a field of dots, sampled from the real 2022
// district and coastline geometry. A slow wave runs across the city and a
// roaming focus lights each district it passes; the pointer takes over the
// focus and parts the dots around it. Decorative: the canvas is aria-hidden.
import { prefersReducedMotion } from './motion-kit.js';

const TAU = Math.PI * 2;
const SPACING = 12;

/** Hue and saturation of a district's map fill, so dots keep the map's palette. */
const hueOf = (value) => {
  const n = Number.parseInt(value.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return { h: 170, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1)) };
};
const hsl = (h, s, l) => [h, s, l];
const mix = (a, b, t) => [
  a[0] + (((((b[0] - a[0]) % 360) + 540) % 360) - 180) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = ([h, s, l]) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
const smooth = (t) => t * t * (3 - 2 * t);
const expoOut = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Sample dots on a hexagonal grid inside the coast and each district. */
function sample(svg) {
  const probe = document.createElement('canvas').getContext('2d');
  const coast = new Path2D(svg.querySelector('clipPath path').getAttribute('d'));
  const districts = [...svg.querySelectorAll('[data-layer="district-fills"] path')].map((path) => ({
    path: new Path2D(path.getAttribute('d')),
    color: hueOf(path.getAttribute('fill') || '#c8dce5'),
    id: Number(path.dataset.district),
  }));
  const dots = [];
  for (let row = 0, y = SPACING / 2; y < 800; row++, y += SPACING * 0.866) {
    for (let x = row % 2 ? SPACING : SPACING / 2; x < 800; x += SPACING) {
      if (!probe.isPointInPath(coast, x, y, 'evenodd')) continue;
      const district = districts.findIndex((item) =>
        probe.isPointInPath(item.path, x, y, 'evenodd'),
      );
      if (district >= 0) dots.push({ x, y, district, seed: Math.random() });
    }
  }
  let minX = 800;
  let minY = 800;
  let maxX = 0;
  let maxY = 0;
  for (const dot of dots) {
    minX = Math.min(minX, dot.x);
    minY = Math.min(minY, dot.y);
    maxX = Math.max(maxX, dot.x);
    maxY = Math.max(maxY, dot.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const reach = Math.hypot(maxX - minX, maxY - minY) / 2;
  // Group by district so each frame issues one fill per district.
  dots.sort((a, b) => a.district - b.district);
  const count = dots.length;
  const data = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    district: new Uint8Array(count),
    delay: new Float32Array(count),
    count,
  };
  dots.forEach((dot, i) => {
    data.x[i] = dot.x;
    data.y[i] = dot.y;
    data.district[i] = dot.district;
    data.delay[i] = (Math.hypot(dot.x - cx, dot.y - cy) / reach) * 0.75 + dot.seed * 0.12;
  });
  return { data, districts, coast, probe, bounds: { minX, minY, maxX, maxY, cx, cy } };
}

export function createHeroField(figure, svg) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  const { data, districts, coast, probe, bounds } = sample(svg);
  const levels = new Float32Array(districts.length);
  let palette;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let ratio = 1;
  let frame = 0;
  let start;
  let last;
  let visible = true;
  const pointer = { x: bounds.cx, y: bounds.cy, active: false, strength: 0, lastMove: -1e9 };
  const focus = { x: bounds.cx, y: bounds.cy };

  const isDark = () => {
    const theme = document.documentElement.dataset.theme;
    return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function updatePalette() {
    const dark = isDark();
    palette = districts.map(({ color: { h, s } }) => {
      const tone = Math.min(1, s * 1.6 + 0.3);
      return dark
        ? { base: hsl(h, 0.3 * tone, 0.5), lit: hsl(h, 0.62 * tone, 0.82) }
        : { base: hsl(h, 0.34 * tone, 0.6), lit: hsl(h, 0.55 * tone, 0.3) };
    });
    palette.coast = dark ? 'rgb(226 236 230 / 0.22)' : 'rgb(27 65 66 / 0.2)';
  }

  function resize() {
    const box = figure.getBoundingClientRect();
    if (!box.width) return;
    ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const pad = 0.05;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    scale = Math.min((box.width * (1 - pad * 2)) / width, (box.height * (1 - pad * 2)) / height);
    offsetX = (box.width - width * scale) / 2 - bounds.minX * scale;
    offsetY = (box.height - height * scale) / 2 - bounds.minY * scale;
  }

  function districtAt(x, y) {
    return districts.findIndex((item) => probe.isPointInPath(item.path, x, y, 'evenodd'));
  }

  function draw(time, frozen) {
    start ??= time;
    const t = (time - start) / 1000;
    const dt = Math.min(0.05, last === undefined ? 0.016 : (time - last) / 1000);
    last = time;

    // Focus: the pointer when present, otherwise a slow wandering path.
    const idle = time - pointer.lastMove > 1800;
    pointer.strength +=
      ((pointer.active && !idle ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt * 6));
    const spanX = (bounds.maxX - bounds.minX) * 0.36;
    const spanY = (bounds.maxY - bounds.minY) * 0.34;
    const wanderX = bounds.cx + spanX * Math.sin(t * 0.21 + 0.6);
    const wanderY = bounds.cy + spanY * Math.sin(t * 0.29 + 2.1);
    const targetX = wanderX + (pointer.x - wanderX) * pointer.strength;
    const targetY = wanderY + (pointer.y - wanderY) * pointer.strength;
    const follow = frozen ? 1 : 1 - Math.exp(-dt * 7);
    focus.x += (targetX - focus.x) * follow;
    focus.y += (targetY - focus.y) * follow;

    const lit = districtAt(focus.x, focus.y);
    for (let i = 0; i < levels.length; i++) {
      const target = i === lit ? 1 : 0;
      levels[i] = frozen ? target : levels[i] + (target - levels[i]) * (1 - Math.exp(-dt * 4));
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
    context.lineWidth = 1 / scale;
    context.strokeStyle = palette.coast;
    context.stroke(coast);

    const radius = SPACING * 0.3;
    const lens = 120;
    const push = 18 + 6 * pointer.strength;
    let current = -1;
    for (let i = 0; i < data.count; i++) {
      const district = data.district[i];
      if (district !== current) {
        if (current >= 0) context.fill();
        current = district;
        const level = levels[district];
        context.fillStyle = css(mix(palette[district].base, palette[district].lit, level));
        context.beginPath();
      }
      let x = data.x[i];
      let y = data.y[i];
      const appear = frozen ? 1 : expoOut(Math.max(0, Math.min(1, (t - data.delay[i]) / 0.9)));
      if (appear <= 0) continue;
      const wave = 0.5 + 0.5 * Math.sin((x * 0.8 + y * 0.6) * 0.026 - t * 1.5);
      let r = radius * (0.58 + 0.42 * wave) * (1 + 0.18 * levels[district]);
      const dx = x - focus.x;
      const dy = y - focus.y;
      const distance = Math.hypot(dx, dy);
      if (distance < lens) {
        const k = smooth(1 - distance / lens);
        const away = distance > 0.001 ? (k * push) / distance : 0;
        x += dx * away;
        y += dy * away;
        r *= 1 + 0.7 * k;
      }
      r *= appear;
      context.moveTo(x + r, y);
      context.arc(x, y, r, 0, TAU);
    }
    if (current >= 0) context.fill();
  }

  // Full frame rate while the pointer steers; 30fps when the city runs on its own.
  const tick = (time) => {
    if (pointer.strength > 0.02 || last === undefined || time - last >= 32) draw(time, false);
    frame = requestAnimationFrame(tick);
  };
  const running = () => frame !== 0;
  function play() {
    if (running() || !visible || document.hidden) return;
    last = undefined;
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function still() {
    // One composed frame: fully bloomed, focus resting on the wandering path.
    start = 0;
    last = undefined;
    draw(9000, true);
  }
  function refresh() {
    resize();
    if (prefersReducedMotion()) still();
  }

  updatePalette();
  resize();
  figure.prepend(canvas);
  figure.classList.add('is-live');

  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(figure);
  const onTheme = () => {
    updatePalette();
    if (prefersReducedMotion() || !running()) still();
  };
  document.documentElement.addEventListener('themechange', onTheme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);

  if (prefersReducedMotion()) {
    still();
    return;
  }

  const toMap = (event) => {
    const box = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - box.left - offsetX) / scale;
    pointer.y = (event.clientY - box.top - offsetY) / scale;
    pointer.lastMove = performance.now();
  };
  figure.addEventListener('pointermove', (event) => {
    pointer.active = true;
    toMap(event);
  });
  figure.addEventListener('pointerdown', (event) => {
    pointer.active = true;
    toMap(event);
  });
  figure.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  // Pause off-screen and in hidden tabs.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play();
    else pause();
  }).observe(figure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else play();
  });
  play();
}
