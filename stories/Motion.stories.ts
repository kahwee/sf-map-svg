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
    map.setViewport([100, 100, 400], { animate: true, duration: 120 });
    await waitFor(() => expect(map.getViewport()).toEqual([100, 100, 400]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) expect(positions.some((size) => size > 400 && size < 800)).toBe(true);
    expect(positions.every((size, i) => i === 0 || size <= positions[i - 1])).toBe(true);
    map.setViewport([150, 150, 300], { animate: true, duration: 1000 });
    map.setViewport([200, 200, 350], { animate: true, duration: 60 });
    await waitFor(() => expect(map.getViewport()).toEqual([200, 200, 350]));
    map.setFeatures({ markerEntrance: { duration: 1000, stagger: 20 } });
    map.setMarkers([{ id: 'new', lng: -122.4, lat: 37.77 }]);
    const animations = map.getAnimations({ subtree: true });
    expect(animations).toHaveLength(reduced ? 0 : 1);
    map.setMarkers([{ id: 'new', lng: -122.41, lat: 37.77 }]);
    expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    map.setMarkers([{ id: 'another', lng: -122.4, lat: 37.77 }]);
    map.setViewport([0, 0, 800], { animate: true, duration: 1000 });
    map.destroy();
    const frozen = map.getViewport();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    expect(map.getViewport()).toEqual(frozen);
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
