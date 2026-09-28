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
