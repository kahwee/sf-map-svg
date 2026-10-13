import { svgElement } from './dom.js';
import { geometryPath, type Project } from './geometry.js';
import type { MapOverlay } from './types.js';
import { validateOverlays } from './validation.js';

/** Prepare overlays before replacing live nodes; each replacement owns an abortable event scope. */
export function createOverlayLayer({
  layer: overlayLayer,
  root,
  project,
  onOverlayActivate,
  isDestroyed,
}: {
  layer: SVGGElement;
  root: HTMLElement;
  project: Project;
  onOverlayActivate: ((overlay: MapOverlay) => void) | undefined;
  isDestroyed(): boolean;
}) {
  let overlayEvents = new AbortController();
  function setOverlays(overlays: readonly MapOverlay[]) {
    if (isDestroyed()) return;
    validateOverlays(overlays);
    const events = new AbortController();
    const next = overlays.map((input) => {
      const overlay = structuredClone(input);
      const node = svgElement('path', {
        'data-overlay-id': overlay.id,
        d: geometryPath(overlay.geometry, project),
        fill: overlay.fill ?? 'none',
        'fill-opacity': overlay.fillOpacity ?? 1,
        stroke: overlay.stroke ?? '#bd8b73',
        'stroke-width': overlay.strokeWidth ?? 2,
        'vector-effect': 'non-scaling-stroke',
        display: overlay.visible === false ? 'none' : 'inline',
        'pointer-events': 'none',
        ...(overlay.label ? { 'aria-label': overlay.label } : {}),
      });
      if (overlay.label) {
        node.setAttribute('role', 'img');
        const title = svgElement('title');
        title.textContent = overlay.label;
        node.append(title);
      }
      if (onOverlayActivate) {
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', overlay.visible === false ? '-1' : '0');
        node.setAttribute(
          'pointer-events',
          overlay.fill && overlay.fill !== 'none' ? 'visiblePainted' : 'stroke',
        );
        node.setAttribute('aria-label', overlay.label ?? overlay.id);
        const activate = () => {
          if (isDestroyed() || events.signal.aborted) return;
          onOverlayActivate(structuredClone(overlay));
          if (isDestroyed() || events.signal.aborted) return;
          root.dispatchEvent(
            new CustomEvent('overlayactivate', {
              bubbles: true,
              detail: { overlay: structuredClone(overlay) },
            }),
          );
        };
        node.addEventListener('click', activate, { signal: events.signal });
        node.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate();
            }
          },
          { signal: events.signal },
        );
      }
      return node;
    });
    overlayEvents.abort();
    overlayEvents = events;
    overlayLayer.replaceChildren(...next);
  }
  return {
    set: setOverlays,
    destroy() {
      overlayEvents.abort();
    },
  };
}
