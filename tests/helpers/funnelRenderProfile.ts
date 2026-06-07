import type { Page } from "@playwright/test";

export type RenderProfileMetrics = {
  domLeadCardCount: number;
  visibleLeadCardCount: number;
  msPerCard: number;
  longTasks?: {
    count: number;
    totalMs: number;
    maxMs: number;
    over200ms: number;
  };
  layoutShifts?: number;
  slowFrames?: number;
};

/** Conta cards no DOM (`data-lead-card` ou fallback legado). */
export async function countDomLeadCards(page: Page): Promise<number> {
  const primary = await page.locator("[data-lead-card]").count();
  if (primary > 0) return primary;
  return page.locator("[data-kanban-sortable-item]").count();
}

/** Cards visíveis (bounding box intersecta viewport). */
export async function countVisibleLeadCards(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cards = document.querySelectorAll("[data-lead-card], [data-kanban-sortable-item]");
    let visible = 0;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0) {
        visible += 1;
      }
    }
    return visible;
  });
}

export function computeMsPerCard(returnToKanbanMs: number, cardCount: number): number {
  const cards = Math.max(cardCount, 1);
  return Math.round(returnToKanbanMs / cards);
}

/** Instala observers de layout shift e frames lentos. */
export const RENDER_PROFILE_INIT_SCRIPT = `
(() => {
  window.__funnelRenderProfile = { layoutShifts: 0, slowFrames: 0, frameObsStarted: false };
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__funnelRenderProfile.layoutShifts += 1;
      }
    });
    obs.observe({ entryTypes: ["layout-shift"] });
  } catch (_) {}

  const countSlowFrame = () => {
    const start = performance.now();
    requestAnimationFrame(() => {
      const dt = performance.now() - start;
      if (dt > 16) window.__funnelRenderProfile.slowFrames += 1;
      if (window.__funnelRenderProfile.frameObsStarted) countSlowFrame();
    });
  };
  window.__funnelRenderProfile.frameObsStarted = true;
  countSlowFrame();
})();
`;

export async function readRenderProfileCounters(page: Page): Promise<{ layoutShifts: number; slowFrames: number }> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __funnelRenderProfile?: { layoutShifts: number; slowFrames: number };
    };
    return {
      layoutShifts: w.__funnelRenderProfile?.layoutShifts ?? 0,
      slowShifts: 0,
      slowFrames: w.__funnelRenderProfile?.slowFrames ?? 0,
    };
  }).then((r) => ({ layoutShifts: r.layoutShifts, slowFrames: r.slowFrames }));
}

export async function resetRenderProfileCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __funnelRenderProfile?: { layoutShifts: number; slowFrames: number; frameObsStarted: boolean };
    };
    if (w.__funnelRenderProfile) {
      w.__funnelRenderProfile.layoutShifts = 0;
      w.__funnelRenderProfile.slowFrames = 0;
    }
  });
}

export function buildRenderProfile(
  returnToKanbanMs: number,
  visibleKanbanCards: number,
  domLeadCardCount: number,
  visibleLeadCardCount: number,
  extras?: Partial<RenderProfileMetrics>
): RenderProfileMetrics {
  return {
    domLeadCardCount,
    visibleLeadCardCount,
    msPerCard: computeMsPerCard(returnToKanbanMs, visibleKanbanCards),
    ...extras,
  };
}
