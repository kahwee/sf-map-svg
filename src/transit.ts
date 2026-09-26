import stations from '../data/bart-stations.json' with { type: 'json' };
import { createSFMap } from './index.js';
import type { TransitAnimationElement } from './types.js';

/** A deliberately schematic, offline station-to-station animation. Starts paused. */
export function createTransitAnimation(): TransitAnimationElement {
  const host = Object.assign(document.createElement('div'), {
    destroy: () => {},
  }) as TransitAnimationElement;
  const root = host.attachShadow({ mode: 'open' });
  const map = createSFMap({ districtLabels: false, landmarks: true, labels: false });
  root.innerHTML = `<style>
    :host{display:block;font:14px system-ui;color:#244747;max-width:800px}
    svg{display:block;width:100%;height:auto} .controls{display:flex;gap:12px;align-items:center;padding:12px;flex-wrap:wrap}
    button{font:inherit;padding:10px 18px;border:1px solid #244747;border-radius:24px;background:#244747;color:white;cursor:pointer}
    label{display:flex;align-items:center;gap:8px;flex:1} input{width:100%;min-width:100px;accent-color:#24789a}
    p{margin:8px 12px;line-height:1.5} output{display:block;min-height:3em;margin:8px 12px}
  </style>${map.svg}<div class="controls"><button type="button">Play</button><label>Journey <input aria-label="Journey progress" type="range" min="0" max="1000" value="0"></label></div><output aria-live="off"></output><p>Schematic BART journey. Straight connections between official station locations; not track geometry, a timetable, or live trains. One loop takes 28 seconds.</p>`;
  const svg = root.querySelector('svg') as SVGSVGElement;
  const ns = 'http://www.w3.org/2000/svg';
  const points = stations.features.map((station) =>
    map.project(station.geometry.coordinates as [number, number]),
  );
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points.map((point) => point.join(',')).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#24789a');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-dasharray', '5 5');
  svg.append(line);
  for (const [x, y] of points) {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(x));
    dot.setAttribute('cy', String(y));
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', 'white');
    dot.setAttribute('stroke', '#24789a');
    dot.setAttribute('stroke-width', '2');
    svg.append(dot);
  }
  const train = document.createElementNS(ns, 'circle');
  train.setAttribute('r', '7');
  train.setAttribute('fill', '#a85036');
  train.setAttribute('stroke', 'white');
  train.setAttribute('stroke-width', '2');
  svg.append(train);
  const button = root.querySelector('button') as HTMLButtonElement;
  const slider = root.querySelector('input') as HTMLInputElement;
  const output = root.querySelector('output') as HTMLOutputElement;
  let progress = 0;
  let frame = 0;
  let previous = 0;
  let playing = false;
  let destroyed = false;
  function draw() {
    const position = progress * (points.length - 1);
    const index = Math.min(Math.floor(position), points.length - 2);
    const fraction = position - index;
    const from = points[index];
    const to = points[index + 1];
    train.setAttribute('cx', String(from[0] + (to[0] - from[0]) * fraction));
    train.setAttribute('cy', String(from[1] + (to[1] - from[1]) * fraction));
    slider.value = String(Math.round(progress * 1000));
    output.textContent = `${stations.features[index].properties.name} → ${stations.features[index + 1].properties.name}`;
  }
  function tick(now: number) {
    if (!playing) return;
    if (previous) progress = (progress + Math.min(now - previous, 100) / 28000) % 1;
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    previous = 0;
    button.textContent = 'Play';
  }
  button.addEventListener('click', () => {
    if (destroyed) return;
    if (playing) pause();
    else {
      playing = true;
      button.textContent = 'Pause';
      frame = requestAnimationFrame(tick);
    }
  });
  slider.addEventListener('input', () => {
    pause();
    progress = Number(slider.value) / 1000;
    draw();
  });
  const visibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', visibility);
  host.destroy = () => {
    destroyed = true;
    pause();
    document.removeEventListener('visibilitychange', visibility);
  };
  draw();
  return host;
}
