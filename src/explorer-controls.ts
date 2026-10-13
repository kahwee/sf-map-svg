import { element } from './dom.js';
import type { createExplorerShell } from './explorer-shell.js';
import { attachNavigation } from './navigation.js';
import type {
  MapViewport,
  NeighborhoodExplorerElement,
  NeighborhoodExplorerOptions,
} from './types.js';

type Controls = NonNullable<NeighborhoodExplorerOptions['controls']>;
type Shell = Pick<
  ReturnType<typeof createExplorerShell>,
  | 'root'
  | 'toolbar'
  | 'canvas'
  | 'hint'
  | 'status'
  | 'modeSelect'
  | 'sourceSelect'
  | 'search'
  | 'results'
  | 'neighborhoodSelect'
  | 'markerSelect'
>;
type Commands = Pick<
  NeighborhoodExplorerElement,
  | 'getViewport'
  | 'zoomBy'
  | 'resetView'
  | 'setLabels'
  | 'stopAnimation'
  | 'setMode'
  | 'setSource'
  | 'selectNeighborhood'
  | 'selectMarker'
> & {
  svg: SVGSVGElement;
  signal: AbortSignal;
  strings: NonNullable<NeighborhoodExplorerOptions['strings']>;
  isDestroyed(): boolean;
  getLabels(): boolean;
  moveView(view: MapViewport): void;
  setView(view: MapViewport): void;
  updateResults(): void;
  search(query: string): string | undefined;
};

/** Own toolbar and form events, touch navigation and control visibility.
 * Commands read current map state; all listeners share the map's disposal signal.
 */
export function createExplorerControls(
  {
    root,
    toolbar,
    canvas,
    hint,
    status,
    modeSelect,
    sourceSelect,
    search,
    results,
    neighborhoodSelect,
    markerSelect,
  }: Shell,
  {
    svg,
    signal,
    strings,
    isDestroyed,
    getLabels,
    getViewport,
    moveView,
    zoomBy,
    resetView,
    setLabels,
    stopAnimation,
    setView,
    setMode,
    setSource,
    selectNeighborhood,
    selectMarker,
    updateResults,
    search: findNeighborhood,
  }: Commands,
) {
  function listen<K extends keyof GlobalEventHandlersEventMap>(
    node: HTMLElement,
    event: K,
    handler: (event: GlobalEventHandlersEventMap[K]) => void,
  ) {
    node.addEventListener(
      event,
      (incoming: Event) => handler(incoming as GlobalEventHandlersEventMap[K]),
      { signal },
    );
  }
  const zoomControls = element('div', '', 'sf-explorer-control-group');
  const panControls = element('div', '', 'sf-explorer-control-group sf-explorer-pan-controls');
  toolbar.append(zoomControls, panControls);
  function button(text: string, label: string, action: () => void, group = zoomControls) {
    const node = element('button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.addEventListener('click', () => action(), { signal });
    group.append(node);
    return node;
  }
  const zoomOut = button('−', 'Zoom out', () => zoomBy(1 / 1.5));
  const zoomText = element('span', '100%', 'sf-explorer-zoom');
  zoomControls.append(zoomText);
  const zoomIn = button('+', 'Zoom in', () => zoomBy(1.5));
  const resetButton = button(
    strings.reset ?? 'Reset',
    strings.reset ?? 'Reset map to city view',
    resetView,
  );
  const labelsButton = button('Labels', 'Show map labels', () => setLabels(!getLabels()));
  for (const [symbol, label, dx, dy] of [
    ['←', 'Pan west', -1, 0],
    ['↑', 'Pan north', 0, -1],
    ['↓', 'Pan south', 0, 1],
    ['→', 'Pan east', 1, 0],
  ] as const)
    button(
      symbol,
      label,
      () => {
        const view = getViewport();
        moveView([view[0] + (dx * view[2]) / 4, view[1] + (dy * view[2]) / 4, view[2]]);
      },
      panControls,
    );
  const touchLabel = strings.touchNavigation ?? 'Touch navigation';
  const touchButton = button(
    touchLabel,
    strings.touchNavigationLabel ?? `Enable ${touchLabel.toLowerCase()}`,
    () => setTouchNavigation(!touchNavigation),
  );
  let touchNavigation = false;
  const navigation = attachNavigation(
    svg,
    getViewport,
    (next) => {
      stopAnimation();
      setView(next);
    },
    signal,
    () => setTouchNavigation(false),
  );
  function setTouchNavigation(enabled: boolean) {
    if (isDestroyed()) return;
    if (typeof enabled !== 'boolean') throw new TypeError('Touch navigation must be a boolean.');
    touchNavigation = enabled;
    navigation.setTouchNavigation(enabled);
    canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
    touchButton.textContent = enabled
      ? (strings.touchNavigationDone ?? 'Done: page scrolling')
      : touchLabel;
    touchButton.setAttribute(
      'aria-label',
      enabled
        ? (strings.touchNavigationExitLabel ?? `Exit ${touchLabel.toLowerCase()}`)
        : (strings.touchNavigationLabel ?? `Enable ${touchLabel.toLowerCase()}`),
    );
    touchButton.setAttribute('aria-pressed', String(enabled));
    root.dataset.touchNavigation = String(enabled);
  }
  listen(modeSelect, 'change', () => {
    const next = modeSelect.value;
    if (next === 'neighborhoods' || next === 'districts' || next === 'basemap') setMode(next);
  });
  listen(search, 'input', updateResults);
  listen(search, 'keydown', (event) => {
    if (event.key === 'Enter') {
      const match = findNeighborhood(search.value);
      if (match) {
        event.preventDefault();
        selectNeighborhood(match);
      }
    }
  });
  listen(sourceSelect, 'change', () => {
    const next = sourceSelect.value;
    if (next === 'realtor' || next === 'sf-find' || next === 'analysis') setSource(next);
  });
  listen(results, 'click', (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-neighborhood-result]')
        : null;
    if (node?.dataset.neighborhoodResult) selectNeighborhood(node.dataset.neighborhoodResult);
  });
  listen(neighborhoodSelect, 'change', () => selectNeighborhood(neighborhoodSelect.value || null));
  listen(markerSelect, 'change', () => selectMarker(markerSelect.value || null));
  return {
    setTouchNavigation,
    cancelNavigation: navigation.cancel,
    update(controls: Controls) {
      for (const node of [zoomIn, zoomOut, zoomText]) node.hidden = controls.zoom === false;
      panControls.hidden = controls.pan === false;
      resetButton.hidden = controls.reset === false;
      labelsButton.hidden = controls.labels === false;
      touchButton.hidden = controls.touch === false;
      if (touchButton.hidden && touchNavigation) setTouchNavigation(false);
      zoomControls.hidden = [...zoomControls.children].every(
        (node) => (node as HTMLElement).hidden,
      );
      toolbar.hidden = zoomControls.hidden && panControls.hidden;
      hint.hidden = controls.help === false;
      if (hint.hidden) svg.setAttribute('aria-describedby', hint.id);
      else svg.removeAttribute('aria-describedby');
      status.classList.toggle('sf-explorer-visually-hidden', controls.status === false);
    },
    updateLabels(labels: boolean) {
      labelsButton.setAttribute('aria-pressed', String(labels));
    },
    updateZoom(zoom: number) {
      zoomText.textContent = `${Math.round(zoom * 100)}%`;
      zoomIn.disabled = zoom >= 12;
      zoomOut.disabled = zoom <= 1;
    },
  };
}
