import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { fullMapData } from '../src/full-data.js';
import { createMap, type MapController } from '../src/map.js';
import { createStoryLifecycle } from './lifecycle.js';

const lifecycle = createStoryLifecycle();
let map: MapController;

function build(id: string, features: NonNullable<Parameters<typeof createMap>[1]>['features']) {
  map = createMap(fullMapData, {
    mode: 'neighborhoods',
    features,
    layers: { landmarks: false, bartStations: false },
    attribution: 'compact',
  });
  lifecycle.track(id, () => map.destroy());
  return map;
}

const meta = {
  title: 'Features/Layer transitions and district morph',
  beforeEach: lifecycle.beforeEach,
  render: (_, { id }) => {
    const controller = build(id, {
      layerTransitions: { duration: 420 },
      districtMorph: { duration: 1200 },
    });
    const frame = document.createElement('div');
    frame.style.maxWidth = '850px';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px';
    const layers = { landmarks: false, bartStations: false, highways: false };
    const actions: [string, () => void][] = [
      ['SFAR realtor', () => controller.setSource('realtor')],
      ['SF Find', () => controller.setSource('sf-find')],
      ['Analysis', () => controller.setSource('analysis')],
      ['Districts', () => controller.setMode('districts')],
      ['Neighborhoods', () => controller.setMode('neighborhoods')],
      ...([2002, 2012, 2022] as const).map(
        (year) => [`${year}`, () => controller.setDistrictYear(year)] as [string, () => void],
      ),
      ...(Object.keys(layers) as (keyof typeof layers)[]).map(
        (key) =>
          [
            `Toggle ${key}`,
            () => {
              layers[key] = !layers[key];
              controller.configure({ layers: { [key]: layers[key] } });
            },
          ] as [string, () => void],
      ),
    ];
    for (const [name, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', action);
      controls.append(button);
    }
    frame.append(controls, controller.element);
    return frame;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const layer = (name: string) =>
  map.element.querySelector<SVGGElement>(`[data-layer="${name}"]`) as SVGGElement;
const running = (node: Element) => node.getAnimations().filter((a) => a.playState === 'running');

export const Interactive: Story = {};

export const LayersFadeInAndOut: Story = {
  render: (_, { id }) => build(id, { layerTransitions: { duration: 60000 } }).element,
  play: async () => {
    const parks = layer('landmarks');
    expect(parks.style.display).toBe('none');
    map.configure({ layers: { landmarks: true } });
    expect(parks.style.display).toBe('');
    expect(running(parks)).toHaveLength(1);
    // Hiding keeps the layer painted until its fade finishes.
    map.configure({ layers: { landmarks: false } });
    expect(parks.style.display).toBe('');
    expect(running(parks)).toHaveLength(1);
    // Turning the feature off settles every layer immediately.
    map.configure({ features: { layerTransitions: false } });
    expect(parks.style.display).toBe('none');
    expect(running(parks)).toHaveLength(0);
    map.configure({ layers: { landmarks: true } });
    expect(parks.style.display).toBe('');
    expect(running(parks)).toHaveLength(0);
  },
};

export const SourcesCrossfade: Story = {
  render: (_, { id }) => build(id, { layerTransitions: { duration: 60000 } }).element,
  play: async () => {
    const before = layer('explorer-neighborhoods').querySelectorAll('path').length;
    map.setSource('sf-find');
    const ghost = map.element.querySelector('[data-layer-transition]') as SVGGElement;
    expect(ghost).not.toBeNull();
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.querySelectorAll('path')).toHaveLength(before);
    expect(ghost.querySelector('[tabindex], [role], [aria-label]')).toBeNull();
    expect(layer('explorer-neighborhoods').querySelectorAll('path').length).not.toBe(before);
    map.destroy();
    expect(map.element.querySelector('[data-layer-transition]')).toBeNull();
  },
};

export const DistrictOutlinesMorph: Story = {
  render: (_, { id }) => {
    build(id, { districtMorph: { duration: 60000 } });
    map.setMode('districts');
    return map.element;
  },
  play: async () => {
    const lines = layer('district-lines');
    map.setDistrictYear(2012);
    const morph = layer('district-morph');
    expect(morph).not.toBeNull();
    expect(morph.getAttribute('aria-hidden')).toBe('true');
    expect(morph.querySelectorAll('path').length).toBeGreaterThanOrEqual(11);
    expect(lines.style.opacity).toBe('0');
    await waitFor(() => expect(morph.querySelector('path')?.getAttribute('d')).toMatch(/^M/));
    // An instant change cancels the morph and restores the exact outlines.
    map.setDistrictYear(2022, { animate: false });
    expect(map.element.querySelector('[data-layer="district-morph"]')).toBeNull();
    expect(lines.style.opacity).toBe('');
    expect(map.element.dataset.year).toBe('2022');
  },
};

export const OffByDefault: Story = {
  render: (_, { id }) => build(id, undefined).element,
  play: async () => {
    map.configure({ layers: { landmarks: true } });
    expect(running(layer('landmarks'))).toHaveLength(0);
    map.setSource('analysis');
    expect(map.element.querySelector('[data-layer-transition]')).toBeNull();
    map.setMode('districts');
    map.setDistrictYear(2002);
    expect(map.element.querySelector('[data-layer="district-morph"]')).toBeNull();
    expect(() => map.configure({ features: { districtMorph: { duration: 0 } } })).toThrow();
    expect(() =>
      map.configure({ features: { layerTransitions: { speed: 1 } as never } }),
    ).toThrow();
  },
};

export const DistrictRestylesCrossfade: Story = {
  render: (_, { id }) => {
    build(id, { layerTransitions: { duration: 60000 } });
    map.setMode('districts');
    return map.element;
  },
  play: async () => {
    map.setDistrictStyle((district) => ({ fill: district.id % 2 ? '#2d6a68' : '#b4432a' }));
    const copy = map.element.querySelector('[data-district-transition]') as SVGGElement;
    expect(copy).not.toBeNull();
    expect(copy.dataset.layer).toBe('district-fills');
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(layer('district-fills').querySelector('[data-district="1"]')?.getAttribute('fill')).toBe(
      '#2d6a68',
    );
    map.configure({ features: { layerTransitions: false } });
    map.setDistrictStyle(undefined);
    expect(map.element.querySelector('[data-district-transition]')).toBeNull();
  },
};
