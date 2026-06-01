import { expect, type Page } from "@playwright/test";

/** Aguarda cards do funil Kanban estarem visíveis. */
export async function waitForKanbanReady(page: Page): Promise<void> {
  await expect(page.locator("[data-kanban-sortable-item]").first()).toBeVisible({
    timeout: 60_000,
  });
}

/** Conta GETs à API REST de leads (refetch completo do funil). */
export function trackLeadsListFetches(page: Page): { getCount: () => number; dispose: () => void } {
  let count = 0;
  const handler = (request: { method: () => string; url: () => string }) => {
    if (request.method() !== "GET") return;
    const url = request.url();
    if (!/\/rest\/v1\/leads/.test(url)) return;
    if (/lead_id=eq\./.test(url)) return;
    count += 1;
  };
  page.on("request", handler);
  return {
    getCount: () => count,
    dispose: () => page.off("request", handler),
  };
}
