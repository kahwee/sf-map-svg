/** One browser frame for camera advancement and the dependent screen-space rendering. */
export function createFrameScheduler({
  request,
  cancel,
  render,
}: {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
  render: () => void;
}) {
  let frame: number | undefined;
  let pending: { id: number; callback: FrameRequestCallback } | undefined;
  let sequence = 0;
  let dirty = false;
  let flushing = false;
  let destroyed = false;
  function schedule() {
    if (!destroyed && !flushing && frame === undefined && (pending || dirty))
      frame = request(flush);
  }
  function flush(time: number) {
    frame = undefined;
    if (destroyed) return;
    flushing = true;
    const next = pending;
    pending = undefined;
    try {
      next?.callback(time);
      if (!destroyed && dirty) {
        dirty = false;
        render();
      }
    } finally {
      flushing = false;
      schedule();
    }
  }
  return {
    request(callback: FrameRequestCallback) {
      const id = ++sequence;
      if (!destroyed) {
        pending = { id, callback };
        schedule();
      }
      return id;
    },
    cancel(id: number) {
      if (pending?.id === id) pending = undefined;
      if (!pending && !dirty && frame !== undefined) {
        cancel(frame);
        frame = undefined;
      }
    },
    invalidate() {
      if (destroyed) return;
      dirty = true;
      schedule();
    },
    destroy() {
      destroyed = true;
      if (frame !== undefined) cancel(frame);
      frame = undefined;
      pending = undefined;
      dirty = false;
    },
  };
}
