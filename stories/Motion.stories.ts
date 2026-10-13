import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { fullMapData } from '../src/full-data.js';
import { createMap } from '../src/map.js';
import { createStoryLifecycle } from './lifecycle.js';

const lifecycle = createStoryLifecycle();
const pins = [
  { id: 'park', label: 'Golden Gate Park', lng: -122.47, lat: 37.77 },
  { id: 'mission', label: 'Mission Dolores', lng: -122.4269, lat: 37.7596 },
];
const meta = {
  title: 'Checks/Motion lifecycle',
  beforeEach: lifecycle.beforeEach,
  render: (_, { id }) => {
    const map = createMap(fullMapData, {
      mode: 'districts',
      features: { motion: { duration: 600 }, markerEntrance: true, selectedMarkerRing: true },
      markers: pins,
    });
    lifecycle.track(id, () => map.destroy());
    const frame = document.createElement('div');
    frame.style.maxWidth = '850px';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px';
    const actions: [string, () => void][] = [
      ['2012 boundaries', () => map.setDistrictYear(2012, { animate: true, duration: 600 })],
      ['2002 boundaries', () => map.setDistrictYear(2002, { animate: true, duration: 600 })],
      ['2022 boundaries', () => map.setDistrictYear(2022, { animate: true, duration: 600 })],
      ['Fly to park', () => map.selectMarker('park')],
      ['Fly to Mission', () => map.selectMarker('mission')],
      ['Stop camera', () => map.camera.stop()],
      ['Reset camera', () => map.camera.reset()],
    ];
    for (const [name, action] of actions) {
      const button = document.createElement('button');
      button.textContent = name;
      button.addEventListener('click', action);
      controls.append(button);
    }
    frame.append(controls, map.element);
    return frame;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const InvalidUpdatesPreserveAnimations: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    map.setDistrictYear(2012, { animate: true, duration: 60000 });
    map.setViewport([100, 100, 400], { animate: true, duration: 100 });
    const fades = [...map.querySelectorAll('[data-district-transition]')];
    const markers = [...map.querySelectorAll('[data-layer="markers"] [data-marker-id]')];
    expect(() => map.setDistrictYear(2020 as never)).toThrow();
    expect(() => map.setDistrictYear(2022, { duration: NaN })).toThrow();
    expect(() => map.setDistrictStyle(() => ({ opacity: Infinity }))).toThrow();
    expect(() => map.setMarkers([{ id: 'invalid', lng: NaN, lat: 37.7 }])).toThrow();
    expect([...map.querySelectorAll('[data-district-transition]')]).toEqual(fades);
    expect([...map.querySelectorAll('[data-layer="markers"] [data-marker-id]')]).toEqual(markers);
    expect(map.dataset.year).toBe('2012');
    await waitFor(() => expect(map.getViewport()).toEqual([100, 100, 400]));
    map.destroy();
    expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(0);
  },
};

export const CameraAndEntranceOwnership: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    map.setViewport([0, 0, 800], { animate: false });
    const positions: number[] = [];
    map.addEventListener('viewportchange', () => positions.push(map.getViewport()[2]));
    map.setViewport([100, 100, 400], { animate: true, duration: 60000 });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced)
      await waitFor(() => expect(positions.some((size) => size > 400 && size < 800)).toBe(true));
    map.stopAnimation();
    map.setViewport([100, 100, 400], { animate: false });
    expect(positions.every((size, i) => i === 0 || size <= positions[i - 1])).toBe(true);
    map.setViewport([150, 150, 300], { animate: true, duration: 1000 });
    map.setViewport([200, 200, 350], { animate: true, duration: 60 });
    await waitFor(() => expect(map.getViewport()).toEqual([200, 200, 350]));
    // Entrances are observed on mounted pins; offscreen pins are now culled.
    map.setViewport([0, 0, 800], { animate: false });
    map.setFeatures({ markerEntrance: { duration: 1000, stagger: 20 } });
    map.setMarkers([{ id: 'new', lng: -122.4, lat: 37.77 }]);
    const animations = map.getAnimations({ subtree: true });
    expect(animations).toHaveLength(reduced ? 0 : 1);
    map.setMarkers([{ id: 'new', lng: -122.41, lat: 37.77 }]);
    expect(map.getAnimations({ subtree: true })).toEqual(animations);
    map.setMarkers([{ id: 'another', lng: -122.4, lat: 37.77 }]);
    expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
    map.setViewport([0, 0, 800], { animate: true, duration: 1000 });
    map.destroy();
    const frozen = map.getViewport();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    expect(map.getViewport()).toEqual(frozen);
  },
};

export const KeyedMarkerUpdates: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    map.setFeatures({ markerEntrance: { duration: 60000, stagger: 0 } });
    const a = { id: 'a', lng: -122.43, lat: 37.77, label: 'First' };
    const b = { id: 'b', lng: -122.42, lat: 37.76, label: 'Second' };
    map.setMarkers([a, b]);
    const node = (id: string) => {
      const found = map.querySelector<SVGGElement>(`[data-marker-id="${id}"]`);
      if (!found) throw new Error(`Missing marker ${id}`);
      return found;
    };
    const first = node('a');
    const second = node('b');
    const option = map.querySelector('option[value="a"]');
    const animations = map.getAnimations({ subtree: true });
    const firstAnimation = first.getAnimations({ subtree: true })[0];
    first.focus();
    let changes = 0;
    const observer = new MutationObserver((records) => {
      changes += records.length;
    });
    observer.observe(map, { attributes: true, childList: true, subtree: true });
    map.setMarkers([{ ...a }, { ...b }]);
    await Promise.resolve();
    observer.disconnect();
    expect(changes).toBe(0);
    expect(node('a')).toBe(first);
    expect(document.activeElement).toBe(first);
    expect(map.getAnimations({ subtree: true })).toEqual(animations);
    map.setMarkers([b, { ...a, lng: -122.44, label: '<Updated>', color: '#abcdef', radius: 9 }]);
    expect(node('a')).toBe(first);
    expect(node('b')).toBe(second);
    expect(map.querySelector('option[value="a"]')).toBe(option);
    expect(first.getAttribute('aria-label')).toBe('<Updated>');
    expect(first.querySelector('title')?.textContent).toBe('<Updated>');
    expect(document.activeElement).toBe(first);
    expect(first.getAnimations({ subtree: true })[0]).toBe(firstAnimation);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const dot = first.lastElementChild;
    if (!dot) throw new Error('Missing marker dot');
    expect(dot.getAttribute('fill')).toBe('#abcdef');
    const c = { id: 'c', lng: -122.41, lat: 37.75 };
    map.setMarkers([b, c]);
    expect(first.isConnected).toBe(false);
    expect(firstAnimation?.playState ?? 'idle').toBe('idle');
    expect(document.activeElement).not.toBe(first);
    expect(node('b')).toBe(second);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    expect(node('c').getAnimations({ subtree: true })).toHaveLength(reduced ? 0 : 1);
    map.selectMarker('b', { fit: false });
    map.addEventListener('markerchange', () => map.setMarkers([c]), { once: true });
    map.setMarkers([{ ...c, selected: true }]);
    expect(map.getSelectedMarker()?.id).toBe('c');
    expect(map.querySelectorAll('[data-marker-id]')).toHaveLength(1);
    map.destroy();
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

export const CameraAndLabelsShareFrames: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    map.setFeatures({ markerEntrance: false });
    map.setViewport([0, 0, 800], { animate: false });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const marker = map.querySelector<SVGGElement>('[data-marker-id="park"]');
    const dot = marker?.lastElementChild;
    const svg = marker?.ownerSVGElement;
    if (!dot || !svg) throw new Error('Missing marker SVG');
    const radius = Number(dot.getAttribute('r')) / map.getViewport()[2];
    map.setViewport([100, 100, 400], { animate: true, duration: 160 });
    let samples = 0;
    await new Promise<void>((resolve, reject) => {
      const sample = () => {
        try {
          const view = map.getViewport();
          expect(Number(dot.getAttribute('r')) / view[2]).toBeCloseTo(radius, 8);
          expect(svg.getAttribute('viewBox')).toBe(`${view[0]} ${view[1]} ${view[2]} ${view[2]}`);
          const label = map.querySelector<SVGTextElement>('[data-layer="explorer-labels"] text');
          if (label) {
            const screenSize =
              (Number(label.getAttribute('font-size')) * svg.getBoundingClientRect().width) /
              view[2];
            expect(screenSize).toBeCloseTo(12, 4);
          }
          samples++;
          if (view[2] === 400) resolve();
          else requestAnimationFrame(sample);
        } catch (error) {
          reject(error);
        }
      };
      requestAnimationFrame(sample);
    });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) expect(samples).toBeGreaterThan(1);
  },
};

export const ReentrantDistrictStyles: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    let nested = false;
    map.setDistrictStyle(() => {
      if (!nested) {
        nested = true;
        map.setDistrictStyle(() => ({ fill: '#abcdef' }));
      }
      return { fill: '#ff0000' };
    });
    expect(map.querySelector('[data-layer="district-fills"] path')?.getAttribute('fill')).toBe(
      '#abcdef',
    );
    let destroy = false;
    map.setDistrictStyle(() => {
      if (destroy) map.destroy();
      return { fill: '#abcdef' };
    });
    destroy = true;
    map.setDistrictYear(2012, { animate: true });
    expect(map.dataset.year).toBe('2022');
    expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(0);
  },
};

export const LabelReuseDuringMotion: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    const settled = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    map.setMode('neighborhoods');
    map.setViewport([100, 100, 500], { animate: false });
    await settled();
    const layer = map.querySelector('[data-layer="explorer-labels"]');
    const before = new Set(layer?.children);
    const original = SVGTextContentElement.prototype.getComputedTextLength;
    let measurements = 0;
    SVGTextContentElement.prototype.getComputedTextLength = function () {
      measurements++;
      return original.call(this);
    };
    try {
      for (let i = 1; i <= 8; i++) {
        map.setViewport([100 + i, 100, 500], { animate: false });
        await settled();
      }
      expect(measurements).toBe(0);
      expect([...(layer?.children ?? [])].some((node) => before.has(node))).toBe(true);
      document.fonts.dispatchEvent(new Event('loadingdone'));
      await settled();
      expect(measurements).toBeGreaterThan(0);
      map.setLabels(false);
      await settled();
      expect(layer?.children).toHaveLength(0);
      map.setLabels(true);
      await settled();
      expect(layer?.children.length).toBeGreaterThan(0);
    } finally {
      SVGTextContentElement.prototype.getComputedTextLength = original;
    }
  },
};

export const AtomicStylesAndInterruptedFades: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    let calls = 0;
    map.setDistrictStyle(() => {
      calls++;
      return { fill: '#abcdef', opacity: 0.8 };
    });
    expect(calls).toBe(11);
    map.selectDistrict(2);
    map.setLayers({ districtLines: false });
    map.setLayers({ districtLines: true });
    expect(calls).toBe(11);
    const before = map.innerHTML;
    expect(() =>
      map.setDistrictStyle((row) => {
        if (row.id === 11) throw new Error('Invalid last district');
        return { fill: '#ff0000' };
      }),
    ).toThrow('Invalid last district');
    expect(map.innerHTML).toBe(before);
    map.setDistrictYear(2012, { animate: true, duration: 1000 });
    expect(calls).toBe(22);
    const old = [...map.querySelectorAll('[data-district-transition]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    expect(old).toHaveLength(reduced ? 0 : 2);
    for (const layer of old) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.querySelectorAll('[tabindex], [role="button"]')).toHaveLength(0);
    }
    map.setDistrictYear(2002, { animate: true, duration: 1000 });
    expect(old.every((node) => !node.isConnected)).toBe(true);
    expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(reduced ? 0 : 2);
    map.setDistrictYear(2022, { animate: true, duration: 0 });
    expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(0);
    map.setDistrictYear(2012, { animate: true, duration: 30 });
    await waitFor(() => expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(0));
    map.setDistrictYear(2022, { animate: true, duration: 1000 });
    map.destroy();
    expect(map.querySelectorAll('[data-district-transition]')).toHaveLength(0);
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

export const LazyMarkerEntrances: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector(
      '.sf-explorer',
    ) as import('../src/types.js').NeighborhoodExplorerElement;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const marker = { id: 'deferred', lng: -122.4, lat: 37.77, label: 'Deferred pin' };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.setFeatures({ markerEntrance: { duration: 60000, stagger: 0 } });
    map.setViewport([0, 0, 100], { animate: false });
    map.setMarkers([marker]);
    await settle();
    expect(map.querySelector('[data-marker-id="deferred"]')).toBeNull();
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    map.setViewport([0, 0, 800], { animate: false });
    await settle();
    const pin = map.querySelector<SVGGElement>('[data-marker-id="deferred"]');
    if (!pin) throw new Error('Deferred pin did not enter the view');
    const entrances = pin.getAnimations({ subtree: true });
    expect(entrances).toHaveLength(reduced ? 0 : 1);
    map.setViewport([0, 0, 100], { animate: false });
    await settle();
    expect(pin.isConnected).toBe(false);
    map.setViewport([0, 0, 800], { animate: false });
    await settle();
    expect(map.querySelector('[data-marker-id="deferred"]')).toBe(pin);
    expect(pin.getAnimations({ subtree: true })).toEqual(entrances);
    map.setViewport([0, 0, 100], { animate: false });
    map.setMarkers([{ ...marker, id: 'cancelled' }]);
    map.setFeatures({ markerEntrance: false });
    map.setFeatures({ markerEntrance: true });
    map.setViewport([0, 0, 800], { animate: false });
    await settle();
    expect(map.querySelector('[data-marker-id="cancelled"]')).toBeTruthy();
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    map.destroy();
    expect(entrances.every((animation) => animation.playState === 'idle')).toBe(true);
  },
};
