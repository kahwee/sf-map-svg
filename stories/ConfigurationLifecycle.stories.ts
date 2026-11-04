import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createNeighborhoodExplorerCore } from '../src/explorer-core.js';
import { createMapShell } from '../src/explorer-shell.js';
import { fullMapData } from '../src/full-data.js';

const meta = {
  title: 'Checks/Configuration transactions',
  render: () => document.createElement('div'),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const PreparedUpdatesCommitOnce: Story = {
  play: async ({ canvasElement }) => {
    const engine = createNeighborhoodExplorerCore({ mode: 'districts' }, fullMapData, {
      createShell: createMapShell,
    });
    canvasElement.append(engine);
    try {
      engine.selectDistrict(2);
      const first = engine.preparePresentation({ year: 2012 });
      expect(engine.dataset.year).toBe('2022');
      const second = engine.preparePresentation({ year: 2002 });
      let commits = 0;
      const commit = () => {
        commits++;
      };
      expect(first?.commit(commit, () => true)).toBe(false);
      expect(commits).toBe(0);
      expect(second?.commit(commit, () => true)).toBe(true);
      expect(engine.dataset.year).toBe('2002');
      expect(engine.getSelectedDistrict()?.id).toBe(2);
      expect(second?.commit(commit, () => true)).toBe(false);
      expect(commits).toBe(1);
      const canceled = engine.preparePresentation({ year: 2012 });
      expect(canceled?.commit(commit, () => false)).toBe(false);
      expect(engine.dataset.year).toBe('2002');
      const interrupted = engine.preparePresentation({ year: 2012 });
      expect(
        interrupted?.commit(
          () => engine.selectDistrict(4),
          () => true,
        ),
      ).toBe(false);
      expect(engine.dataset.year).toBe('2002');
      expect(engine.getSelectedDistrict()?.id).toBe(4);
      const disposed = engine.preparePresentation({ year: 2022 });
      engine.destroy();
      expect(disposed?.commit(commit, () => true)).toBe(false);
      expect(commits).toBe(1);
    } finally {
      engine.destroy();
      engine.remove();
    }
  },
};

export const DistrictUpdatesInvalidatePreparation: Story = {
  play: async ({ canvasElement }) => {
    const engine = createNeighborhoodExplorerCore({ mode: 'districts' }, fullMapData, {
      createShell: createMapShell,
    });
    canvasElement.append(engine);
    try {
      const prepared = engine.preparePresentation({ year: 2012 });
      engine.selectDistrict(3);
      let committed = false;
      expect(
        prepared?.commit(
          () => {
            committed = true;
          },
          () => true,
        ),
      ).toBe(false);
      expect(committed).toBe(false);
      expect(engine.dataset.year).toBe('2022');
      expect(engine.getSelectedDistrict()?.id).toBe(3);
    } finally {
      engine.destroy();
      engine.remove();
    }
  },
};
