import { expect, type Page } from "@playwright/test";

/** Abre o funil na raiz e aguarda colunas do Kanban. */
export async function gotoFunnelPage(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("heading", { name: /funil de vendas/i }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await page.locator(".kanban-scroll").first().waitFor({ state: "visible", timeout: 60_000 });
}

/** Cards renderizados e visíveis (keep-alive deixa cópias ocultas no DOM). */
export function visibleKanbanCards(page: Page) {
  return page.locator("[data-kanban-sortable-item]:visible");
}

/** Aguarda ao menos um card visível no Kanban. */
export async function waitForKanbanReady(page: Page): Promise<void> {
  await expect(visibleKanbanCards(page).first()).toBeVisible({
    timeout: 90_000,
  });
}

export async function countVisibleKanbanCards(page: Page): Promise<number> {
  return visibleKanbanCards(page).count();
}

/** Sidebar desktop (evita botões duplicados do menu mobile em Sheet). */
function desktopSidebarNav(page: Page) {
  return page.locator("aside.hidden.md\\:flex nav").first();
}

/** Garante labels visíveis no menu (sidebar recolhida só mostra ícones). */
export async function ensureDesktopSidebarExpanded(page: Page): Promise<void> {
  const aside = page.locator("aside.hidden.md\\:flex").first();
  const funil = aside.getByRole("button", { name: "Funil de Vendas", exact: true });
  if ((await funil.count()) > 0) return;
  const expand = aside.getByTitle("Expandir menu");
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
    await funil.waitFor({ state: "visible", timeout: 10_000 });
  }
}

export async function clickSidebarView(page: Page, label: string): Promise<void> {
  await ensureDesktopSidebarExpanded(page);
  const btn = desktopSidebarNav(page).getByRole("button", { name: label, exact: true });
  await btn.click({ timeout: 20_000 });
}

/** Botão só com ícone; ciclo: Kanban → Lista → Calendário → Kanban. */
export async function clickViewModeToggle(page: Page, title: string): Promise<void> {
  await page.locator(`button[title="${title}"]`).click({ timeout: 15_000 });
}

export async function clickKanbanListViewToggle(page: Page): Promise<void> {
  await clickViewModeToggle(page, "Ver em lista");
}

/** Volta ao Kanban a partir de Lista ou Calendário (até 2 cliques no ciclo). */
export async function returnToKanbanViewMode(page: Page): Promise<void> {
  if ((await visibleKanbanCards(page).count()) > 0) return;

  for (let step = 0; step < 3; step++) {
    if ((await visibleKanbanCards(page).count()) > 0) return;
    const next = page.locator(
      'button[title="Ver calendário"], button[title="Ver em Kanban"]'
    );
    if ((await next.count()) === 0) break;
    await next.first().click({ timeout: 10_000 });
    await page.waitForTimeout(400);
  }

  await visibleKanbanCards(page).first().waitFor({ state: "visible", timeout: 30_000 });
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
