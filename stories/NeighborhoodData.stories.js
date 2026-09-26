import { useEffect, useMemo } from 'storybook/preview-api';
import { neighborhoodSources } from '../data/index.ts';
import { createNeighborhoodExplorer } from '../src/explorer.ts';

export default {
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
  render: (args) => {
    const explorer = useMemo(
      () => createNeighborhoodExplorer(args),
      [args.source, args.neighborhood, args.mode, args.labels, args.year],
    );
    useEffect(() => () => explorer.destroy(), [explorer]);
    return explorer;
  },
};
export const CityOverview = {};
export const InnerMission = { args: { neighborhood: 'Inner Mission' } };
export const MissionSFFind = { args: { source: 'sf-find', neighborhood: 'Mission' } };
export const OuterMission = { args: { neighborhood: 'Outer Mission' } };
export const MissionAnalysis = { args: { source: 'analysis', neighborhood: 'Mission' } };
export const OuterMissionAnalysis = { args: { source: 'analysis', neighborhood: 'Outer Mission' } };
export const NoPa = { args: { neighborhood: 'NoPa' } };
export const SoMa = { args: { neighborhood: 'SoMa' } };
export const Mobile = {
  args: { neighborhood: 'Inner Mission' },
  decorators: [
    (story) => {
      const frame = document.createElement('div');
      frame.style.cssText = 'width:390px;max-width:100%';
      frame.append(story());
      return frame;
    },
  ],
};

export const DistrictNumbers = { args: { mode: 'districts' } };
export const LabelsOff = { args: { labels: false } };
