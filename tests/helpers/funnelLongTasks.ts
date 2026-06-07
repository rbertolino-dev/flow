import type { Page } from "@playwright/test";

export type LongTaskEntry = {
  duration: number;
  startTime: number;
  name?: string;
};

/** Instala PerformanceObserver de longtask antes da navegação (addInitScript no spec). */
export const LONG_TASK_INIT_SCRIPT = `
(() => {
  window.__funnelLongTasks = [];
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__funnelLongTasks.push({
          duration: e.duration,
          startTime: e.startTime,
          name: e.name || "longtask",
        });
      }
    });
    obs.observe({ entryTypes: ["longtask"] });
  } catch (_) {}
})();
`;

export async function readLongTasks(page: Page): Promise<LongTaskEntry[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __funnelLongTasks?: LongTaskEntry[] };
    return w.__funnelLongTasks ?? [];
  });
}

export async function resetLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __funnelLongTasks?: LongTaskEntry[] };
    w.__funnelLongTasks = [];
  });
}

export function summarizeLongTasks(tasks: LongTaskEntry[]): {
  count: number;
  totalMs: number;
  maxMs: number;
  over50ms: number;
  over200ms: number;
} {
  let totalMs = 0;
  let maxMs = 0;
  let over50ms = 0;
  let over200ms = 0;
  for (const t of tasks) {
    totalMs += t.duration;
    maxMs = Math.max(maxMs, t.duration);
    if (t.duration >= 50) over50ms += 1;
    if (t.duration >= 200) over200ms += 1;
  }
  return { count: tasks.length, totalMs, maxMs, over50ms, over200ms };
}
