type ExplorerArgs = {
  source: 'realtor' | 'sf-find' | 'analysis';
  neighborhood: string;
  mode: 'neighborhoods' | 'districts';
  labels: boolean;
  year: 2002 | 2012 | 2022;
};

import type { Meta, StoryObj } from '@storybook/html-vite';
import { neighborhoodSources } from '../data/index.ts';
import { createNeighborhoodExplorer } from '../src/explorer.ts';
import { createStoryLifecycle } from './lifecycle.ts';

const lifecycle = createStoryLifecycle();
const meta = {
  title: 'Data/Neighborhood explorer',
  parameters: { layout: 'padded' },
  args: { source: 'realtor', neighborhood: '', mode: 'neighborhoods', labels: true, year: 2022 },
  argTypes: {
    mode: { control: 'select', options: ['neighborhoods', 'districts'] },
    labels: { control: 'boolean' },
    year: { control: 'select', options: [2002, 2012, 2022] },
    source: { control: 'select', options: neighborhoodSources },
    neighborhood: {
      control: 'text',
      description: 'Optional initial ID, canonical name, source name, or alias.',
    },
  },
  beforeEach: lifecycle.beforeEach,
  render: (args, { id }) => {
    const explorer = createNeighborhoodExplorer(args);
    lifecycle.track(id, () => explorer.destroy());
    return explorer;
  },
} satisfies Meta<ExplorerArgs>;

export default meta;
type Story = StoryObj<ExplorerArgs>;

export const CityOverview: Story = {};
export const InnerMission: Story = { args: { neighborhood: 'Inner Mission' } };
export const MissionSFFind: Story = { args: { source: 'sf-find', neighborhood: 'Mission' } };
export const OuterMission: Story = { args: { neighborhood: 'Outer Mission' } };
export const MissionAnalysis: Story = { args: { source: 'analysis', neighborhood: 'Mission' } };
export const OuterMissionAnalysis: Story = {
  args: { source: 'analysis', neighborhood: 'Outer Mission' },
};
export const NoPa: Story = { args: { neighborhood: 'NoPa' } };
export const SoMa: Story = { args: { neighborhood: 'SoMa' } };
export const Mobile: Story = {
  args: { neighborhood: 'Inner Mission' },
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  decorators: [
    (story) => {
      const frame = document.createElement('div');
      frame.style.cssText = 'width:390px;max-width:100%';
      frame.append(story());
      return frame;
    },
  ],
};

export const DistrictNumbers: Story = { args: { mode: 'districts' } };
export const LabelsOff: Story = { args: { labels: false } };
