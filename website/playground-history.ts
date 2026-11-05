import type { PlaygroundState } from './playground-model.ts';

/** Detached snapshots; a new edit after undo discards the abandoned redo branch. */
export function createPlaygroundHistory(initial: PlaygroundState) {
  const snapshots = [structuredClone(initial)];
  let index = 0;
  return {
    get canUndo() {
      return index > 0;
    },
    get canRedo() {
      return index < snapshots.length - 1;
    },
    record(state: PlaygroundState) {
      if (JSON.stringify(state) === JSON.stringify(snapshots[index])) return;
      snapshots.splice(index + 1);
      snapshots.push(structuredClone(state));
      if (snapshots.length > 60) snapshots.shift();
      index = snapshots.length - 1;
    },
    undo() {
      if (index === 0) return undefined;
      return structuredClone(snapshots[--index]);
    },
    redo() {
      if (index === snapshots.length - 1) return undefined;
      return structuredClone(snapshots[++index]);
    },
  };
}
