import { type RefObject, useLayoutEffect } from "react";

const SCROLL_AREA_VIEWPORT = "[data-radix-scroll-area-viewport]";
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="checkbox"], [role="switch"], [contenteditable="true"]';

const AXIS_THRESHOLD_PX = 10;

function shouldIgnorePanStart(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return true;
  if (target.closest(INTERACTIVE_SELECTOR)) return true;
  return false;
}

export type UseKanbanHorizontalPanOptions = {
  enabled?: boolean;
  /** Shift + roda: scroll horizontal (default true) */
  shiftWheel?: boolean;
};

/**
 * Pan horizontal por arrastar no container com overflow-x (funil kanban),
 * sem interferir com @dnd-kit sortable nem com scroll vertical nas colunas Radix.
 */
export function useKanbanHorizontalPan(
  ref: RefObject<HTMLElement | null>,
  options: UseKanbanHorizontalPanOptions = {}
) {
  const enabled = options.enabled !== false;
  const shiftWheel = options.shiftWheel !== false;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let activePointerId: number | null = null;
    let startClientX = 0;
    let startClientY = 0;
    let startScrollLeft = 0;
    let isPanning = false;
    let downInsideRadixViewport = false;

    const cleanupGesture = () => {
      if (isPanning && activePointerId != null) {
        try {
          if (el.hasPointerCapture(activePointerId)) {
            el.releasePointerCapture(activePointerId);
          }
        } catch {
          /* ignore */
        }
      }
      activePointerId = null;
      isPanning = false;
      el.classList.remove("kanban-pan-grabbing");
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onWindowPointerMove, true);
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerUp, true);
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (activePointerId == null || e.pointerId !== activePointerId) return;

      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;

      if (!isPanning) {
        if (downInsideRadixViewport) {
          if (Math.abs(dx) < AXIS_THRESHOLD_PX && Math.abs(dy) < AXIS_THRESHOLD_PX) return;
          if (Math.abs(dy) >= Math.abs(dx)) {
            cleanupGesture();
            return;
          }
          if (Math.abs(dx) < AXIS_THRESHOLD_PX) return;
        } else {
          if (Math.abs(dx) < AXIS_THRESHOLD_PX) return;
        }

        isPanning = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        el.classList.add("kanban-pan-grabbing");
        document.body.style.userSelect = "none";
      }

      if (isPanning) {
        e.preventDefault();
        e.stopImmediatePropagation();
        el.scrollLeft = startScrollLeft - dx;
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (activePointerId == null || e.pointerId !== activePointerId) return;
      cleanupGesture();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (shouldIgnorePanStart(e.target)) return;

      activePointerId = e.pointerId;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startScrollLeft = el.scrollLeft;
      isPanning = false;
      const t = e.target;
      downInsideRadixViewport =
        t instanceof Element && !!t.closest(SCROLL_AREA_VIEWPORT);

      window.addEventListener("pointermove", onWindowPointerMove, true);
      window.addEventListener("pointerup", onWindowPointerUp, true);
      window.addEventListener("pointercancel", onWindowPointerUp, true);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("pointerdown", onPointerDown);
    if (shiftWheel) {
      el.addEventListener("wheel", onWheel, { passive: false });
    }

    return () => {
      cleanupGesture();
      el.removeEventListener("pointerdown", onPointerDown);
      if (shiftWheel) {
        el.removeEventListener("wheel", onWheel);
      }
    };
  }, [ref, enabled, shiftWheel]);
}
