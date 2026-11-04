import { prepareConfiguration } from './configuration.js';
import type { MapConfiguration } from './controller-types.js';
import { controlKeys, layerKeys } from './features.js';
import type { NeighborhoodExplorerElement } from './types.js';

/** A prepared engine update may commit once, only while all revisions remain current. */
export interface PreparedPresentation {
  commit(onCommit: () => void, isCurrent: () => boolean): boolean;
}
export interface ConfigurationTarget
  extends Pick<NeighborhoodExplorerElement, 'setFeatures' | 'setLayers' | 'setControls'> {
  preparePresentation(patch: MapConfiguration): PreparedPresentation | undefined;
}

/** Own the public configuration snapshot and invalidate stale updates before DOM mutation. */
export function createConfigurationController(
  initial: ReturnType<typeof prepareConfiguration>,
  element: ConfigurationTarget,
  isDestroyed: () => boolean,
) {
  let config = initial;
  let configurationRevision = 0;
  function configure(patch: MapConfiguration) {
    const revision = ++configurationRevision;
    const next = prepareConfiguration(config, patch);
    const hasFeatures = 'features' in patch,
      hasLayers = 'layers' in patch,
      hasControls = 'controls' in patch;
    const layers = Object.fromEntries(layerKeys.map((key) => [key, next.layers[key]]));
    const controls = Object.fromEntries(controlKeys.map((key) => [key, next.controls[key]]));
    const features =
      patch.features === undefined
        ? next.features
        : Object.fromEntries(
            Object.keys(patch.features).map((key) => [
              key,
              next.features[key as keyof typeof next.features],
            ]),
          );
    const presentation = element.preparePresentation({
      ...patch,
      ...('appearance' in patch ? { appearance: next.appearance } : {}),
    });
    const committed = presentation?.commit(
      () => {
        config = next;
        if (hasFeatures) element.setFeatures(features);
        if (hasLayers) element.setLayers(layers);
        if (hasControls) element.setControls(controls);
      },
      () => !isDestroyed() && revision === configurationRevision,
    );
    return committed === true && !isDestroyed() && revision === configurationRevision;
  }
  return {
    configure,
    get current() {
      return config;
    },
    invalidate() {
      configurationRevision++;
    },
  };
}
