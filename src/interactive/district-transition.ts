/** Own both district-layer fades and remove their inert copies synchronously on cancellation. */
export function createDistrictTransition() {
  const active = new Map<Animation, SVGGElement>();
  const remove = (animation: Animation, node: SVGGElement) => {
    active.delete(animation);
    node.remove();
  };
  return {
    cancel() {
      for (const [animation, node] of active) {
        animation.cancel();
        node.remove();
      }
      active.clear();
    },
    fade(layer: SVGGElement, duration: number) {
      if (!duration) return;
      const old = layer.cloneNode(true) as SVGGElement;
      old.dataset.districtTransition = '';
      old.setAttribute('aria-hidden', 'true');
      old.style.pointerEvents = 'none';
      for (const path of old.querySelectorAll('[data-district]')) {
        path.removeAttribute('tabindex');
        path.removeAttribute('role');
        path.removeAttribute('aria-label');
        path.removeAttribute('aria-pressed');
      }
      layer.after(old);
      const animation = old.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration,
        easing: 'ease-out',
      });
      active.set(animation, old);
      animation.finished.then(
        () => remove(animation, old),
        () => remove(animation, old),
      );
    },
  };
}
