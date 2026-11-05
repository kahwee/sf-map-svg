import {
  createMap,
  type MapController,
  type MapData,
  type MapOptions,
  renderMap,
} from '@kahwee/sf-map-svg';
import { enhanceDropdowns } from './dropdown.js';
import {
  interactiveOptions,
  type PlaygroundState,
  staticData,
  staticOptions,
} from './playground-model.ts';

/** Own the preview controller and retain camera/selection across static mode and page suspension. */
export function createPlaygroundPreview(container: HTMLElement, selection: HTMLElement) {
  let map: MapController | undefined;
  let browserView:
    | {
        viewport: ReturnType<MapController['camera']['get']>;
        marker: ReturnType<MapController['getSelectedMarker']>;
        district: ReturnType<MapController['getSelectedDistrict']>;
        neighborhood: ReturnType<MapController['getSelectedNeighborhood']>;
      }
    | undefined;
  function rememberBrowserView(controller: MapController) {
    browserView = {
      viewport: controller.camera.get(),
      marker: controller.getSelectedMarker(),
      district: controller.getSelectedDistrict(),
      neighborhood: controller.getSelectedNeighborhood(),
    };
  }
  function restoreBrowserView(controller: MapController, state: PlaygroundState) {
    if (!browserView) return;
    const { viewport, marker, district, neighborhood } = browserView;
    controller.camera.set(viewport, { animate: false });
    if (marker) controller.selectMarker(marker.id, { fit: false });
    if (district) controller.selectDistrict(district.id, { fit: false });
    if (neighborhood?.source === state.source)
      controller.selectNeighborhood(neighborhood.id, { fit: false });
  }
  let lastOptions: MapOptions | undefined;
  function mountBrowser(data: MapData, state: PlaygroundState, options: MapOptions): MapController {
    if (!map) {
      map = createMap(data, options);
      map.on('districtchange', ({ id, year }) => {
        selection.textContent =
          id === null ? 'District selection cleared.' : `District ${id} · ${year} boundaries`;
      });
      map.on('neighborhoodchange', ({ name, source }) => {
        selection.textContent = name ? `${name} · ${source}` : 'Neighborhood selection cleared.';
      });
      map.on('markerchange', ({ marker }) => {
        selection.textContent = marker ? (marker.label ?? marker.id) : 'Pin selection cleared.';
      });
      restoreBrowserView(map, state);
    } else {
      const {
        appearance,
        mode,
        source,
        year,
        labels,
        layers,
        features,
        controls,
        markers,
        overlays,
      } = options;
      if (
        JSON.stringify({ appearance, mode, source, year, labels, layers, features, controls }) !==
        JSON.stringify(
          lastOptions && {
            appearance: lastOptions.appearance,
            mode: lastOptions.mode,
            source: lastOptions.source,
            year: lastOptions.year,
            labels: lastOptions.labels,
            layers: lastOptions.layers,
            features: lastOptions.features,
            controls: lastOptions.controls,
          },
        )
      )
        map.configure({ appearance, mode, source, year, labels, layers, features, controls });
      if (JSON.stringify(markers) !== JSON.stringify(lastOptions?.markers))
        map.setMarkers(markers ?? []);
      if (JSON.stringify(overlays) !== JSON.stringify(lastOptions?.overlays))
        map.setOverlays(overlays ?? []);
    }
    // The option builder creates a fresh snapshot for each render.
    lastOptions = options;
    return map;
  }

  function dispose() {
    if (map) rememberBrowserView(map);
    map?.destroy();
    map = undefined;
    lastOptions = undefined;
  }

  return {
    render(data: MapData, state: PlaygroundState) {
      container.dataset.updateStrategy = 'configure';
      if (state.render === 'static') {
        container.innerHTML = renderMap(staticData(data, state.source), staticOptions(state)).svg;
        dispose();
        selection.textContent = 'Self-contained SVG · full city extent';
      } else {
        const controller = mountBrowser(data, state, interactiveOptions(state));
        if (container.firstElementChild !== controller.element) {
          container.replaceChildren(controller.element);
          selection.textContent = state.pins
            ? 'Choose a pin or explore the map.'
            : 'Click an area to explore. Drag to pan.';
        }
        enhanceDropdowns(controller.element);
      }
      container.querySelector('svg')?.setAttribute('data-design-preview', '');

      return { resolved: map?.getResolvedConfiguration(), available: map?.getCapabilities() };
    },
    reset() {
      browserView = undefined;
      map?.camera.reset({ animate: false });
    },
    dispose,
  };
}
