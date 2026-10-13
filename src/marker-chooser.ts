import { element } from './dom.js';
import type { MapMarker } from './types.js';

/** A modeless choice panel also available when compact embeds hide native pickers. */
export function createMarkerChooser(
  canvas: HTMLElement,
  svg: SVGSVGElement,
  select: (id: string) => void,
) {
  let panel: HTMLElement | undefined;
  let events: AbortController | undefined;
  let origin: SVGElement | undefined;
  function close(restoreFocus = true) {
    const focused = panel?.contains(document.activeElement);
    events?.abort();
    panel?.remove();
    panel = undefined;
    if (focused && restoreFocus)
      (origin?.isConnected && origin.getClientRects().length ? origin : svg).focus({
        preventScroll: true,
      });
  }
  return {
    close,
    open(markers: readonly MapMarker[], opener: SVGElement) {
      close(false);
      origin = opener;
      events = new AbortController();
      const signal = events.signal;
      panel = element('div', '', 'sf-marker-chooser');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Choose a place at this location');
      const title = element('strong', 'Choose a place');
      const dismiss = element('button', 'Close');
      dismiss.type = 'button';
      dismiss.addEventListener('click', () => close(), { signal });
      panel.append(title, dismiss);
      for (const marker of markers) {
        const button = element('button', marker.label ?? marker.id);
        button.type = 'button';
        button.dataset.markerChoice = marker.id;
        button.addEventListener(
          'click',
          () => {
            close(false);
            select(marker.id);
          },
          { signal },
        );
        panel.append(button);
      }
      panel.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        },
        { signal },
      );
      panel.addEventListener(
        'focusout',
        (event) => {
          if (event.relatedTarget instanceof Node && !panel?.contains(event.relatedTarget))
            close(false);
        },
        { signal },
      );
      canvas.append(panel);
      panel
        .querySelector<HTMLButtonElement>('[data-marker-choice]')
        ?.focus({ preventScroll: true });
    },
  };
}
