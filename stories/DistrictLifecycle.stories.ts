import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { fullMapData } from '../src/full-data.js';
import { createMap } from '../src/map.js';

const meta = {
  title: 'Checks/District activation lifecycle',
  render: () => document.createElement('div'),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReentrantSelectionAndDestruction: Story = {
  play: async ({ canvasElement }) => {
    for (const input of ['pointer', 'keyboard'] as const) {
      for (const action of ['destroy', 'select'] as const) {
        const map = createMap(fullMapData, { mode: 'districts' });
        const focusTarget = document.createElement('button');
        focusTarget.textContent = 'Continue after district change';
        canvasElement.append(map.element, focusTarget);
        try {
          const path = map.element.querySelector<SVGPathElement>(
            '[data-layer="district-fills"] [data-district="1"]',
          );
          expect(path).not.toBeNull();
          const activations: unknown[] = [];
          map.element.addEventListener('districtactivate', (event) => {
            activations.push((event as CustomEvent).detail);
          });
          map.element.addEventListener(
            'districtchange',
            () => {
              if (action === 'destroy') map.destroy();
              else map.selectDistrict(2);
              focusTarget.focus();
            },
            { once: true },
          );
          path?.focus();
          path?.dispatchEvent(
            input === 'pointer'
              ? new MouseEvent('click', { bubbles: true })
              : new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
          );
          expect(activations).toEqual([]);
          expect(document.activeElement).toBe(focusTarget);
          if (action === 'destroy') expect(map.destroyed).toBe(true);
          else expect(map.getSelectedDistrict()?.id).toBe(2);
        } finally {
          map.destroy();
          map.element.remove();
          focusTarget.remove();
        }
      }
    }
  },
};

export const ActivationCallbackPreservesFocus: Story = {
  play: async ({ canvasElement }) => {
    for (const action of ['destroy', 'select'] as const) {
      const map = createMap(fullMapData, { mode: 'districts' });
      const focusTarget = document.createElement('button');
      focusTarget.textContent = 'Continue after activation';
      canvasElement.append(map.element, focusTarget);
      try {
        const path = map.element.querySelector<SVGPathElement>(
          '[data-layer="district-fills"] [data-district="1"]',
        );
        let activations = 0;
        map.element.addEventListener('districtactivate', () => {
          activations++;
          if (action === 'destroy') map.destroy();
          else map.selectDistrict(2);
          focusTarget.focus();
        });
        path?.focus();
        path?.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
        );
        expect(activations).toBe(1);
        expect(document.activeElement).toBe(focusTarget);
        if (action === 'destroy') expect(map.destroyed).toBe(true);
        else expect(map.getSelectedDistrict()?.id).toBe(2);
      } finally {
        map.destroy();
        map.element.remove();
        focusTarget.remove();
      }
    }
  },
};

export const UninterruptedActivation: Story = {
  play: async ({ canvasElement }) => {
    const map = createMap(fullMapData, { mode: 'districts' });
    canvasElement.append(map.element);
    try {
      const path = map.element.querySelector<SVGPathElement>(
        '[data-layer="district-fills"] [data-district="1"]',
      );
      const activations: number[] = [];
      map.element.addEventListener('districtactivate', (event) => {
        activations.push((event as CustomEvent<{ id: number }>).detail.id);
      });
      path?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (const key of ['Enter', ' ']) {
        path?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(path);
      }
      expect(activations).toEqual([1, 1, 1]);
      expect(map.getSelectedDistrict()?.id).toBe(1);
    } finally {
      map.destroy();
      map.element.remove();
    }
  },
};
