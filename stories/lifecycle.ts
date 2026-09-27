/** Tie imperative DOM components to Storybook's per-story teardown. */
export function createStoryLifecycle() {
  const disposers = new Map<string, () => void>();

  return {
    beforeEach:
      ({ id }: { id: string }) =>
      () => {
        disposers.get(id)?.();
        disposers.delete(id);
      },
    track(id: string, dispose: () => void) {
      disposers.get(id)?.();
      disposers.set(id, dispose);
    },
  };
}
