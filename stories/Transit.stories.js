import { createTransitAnimation } from '../src/transit.ts';
export default {
  title: 'Maps/Transit animation',
  loaders: [() => ({ disposal: {} })],
  render: (_, { loaded }) => {
    const map = createTransitAnimation();
    loaded.disposal.map = map;
    return map;
  },
  beforeEach:
    ({ loaded }) =>
    () =>
      loaded.disposal.map?.destroy(),
};
export const SchematicBART = {};
