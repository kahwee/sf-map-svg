/** Remove interaction and accessibility hooks from a decorative copy of a layer. */
function makeInert(node: Element) {
  node.setAttribute('aria-hidden', 'true');
  (node as SVGElement).style.pointerEvents = 'none';
  for (const item of [node, ...node.querySelectorAll('*')]) {
    for (const name of ['id', 'tabindex', 'role', 'aria-label', 'aria-pressed'])
      item.removeAttribute(name);
  }
}

/**
 * Opacity transitions for interactive layer switches and source swaps. `duration()` is read
 * on every change, so reduced motion, construction, and runtime feature patches take effect
 * immediately. All animations are owned here and settle synchronously on cancel.
 */
export function createLayerTransitions(duration: () => number) {
  const fades = new Map<Element, { animation: Animation; hiding: boolean }>();
  const ghosts = new Set<{ animation: Animation; node: Element }>();

  function settle(node: SVGElement | HTMLElement) {
    const running = fades.get(node);
    if (!running) return;
    fades.delete(node);
    running.animation.cancel();
    if (running.hiding) node.style.display = 'none';
  }

  return {
    /** The active transition duration in milliseconds, or 0 when transitions are off. */
    duration,
    /** Show or hide a layer, fading when a transition duration is active. */
    set(node: SVGElement | HTMLElement, visible: boolean) {
      const running = fades.get(node);
      const shown = node.style.display !== 'none' && !running?.hiding;
      if (running) {
        fades.delete(node);
        running.animation.cancel();
      }
      const ms = duration();
      if (!ms || visible === shown || typeof node.animate !== 'function') {
        node.style.display = visible ? '' : 'none';
        return;
      }
      node.style.display = '';
      const animation = node.animate(
        visible ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        { duration: ms, easing: visible ? 'ease-out' : 'ease-in', fill: 'forwards' },
      );
      const entry = { animation, hiding: !visible };
      fades.set(node, entry);
      animation.finished.then(
        () => {
          if (fades.get(node) === entry) settle(node);
        },
        () => {},
      );
    },
    /**
     * Replace a visible layer's contents while an inert copy of the old contents fades out
     * above the new ones as they fade in.
     */
    crossfade(node: SVGGElement, replace: () => void) {
      const ms = duration();
      if (!ms || node.style.display === 'none' || typeof node.animate !== 'function') {
        replace();
        return;
      }
      const ghost = node.cloneNode(true) as SVGGElement;
      makeInert(ghost);
      ghost.dataset.layerTransition = '';
      replace();
      node.after(ghost);
      const fadeOut = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: ms,
        easing: 'ease-out',
        fill: 'forwards',
      });
      const entry = { animation: fadeOut, node: ghost };
      ghosts.add(entry);
      const remove = () => {
        ghosts.delete(entry);
        ghost.remove();
      };
      fadeOut.finished.then(remove, remove);
      settle(node);
      const fadeIn = node.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms,
        easing: 'ease-out',
      });
      const incoming = { animation: fadeIn, hiding: false };
      fades.set(node, incoming);
      fadeIn.finished.then(
        () => {
          if (fades.get(node) === incoming) fades.delete(node);
        },
        () => {},
      );
    },
    /** Jump every layer to its final state and remove all decorative copies. */
    cancel() {
      for (const node of [...fades.keys()]) settle(node as SVGElement);
      for (const { animation, node } of [...ghosts]) {
        animation.cancel();
        node.remove();
      }
      ghosts.clear();
    },
  };
}
