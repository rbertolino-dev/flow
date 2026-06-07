import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  clickKanbanListViewToggle,
  returnToKanbanViewMode,
  gotoFunnelPage,
  waitForKanbanReady,
  countVisibleKanbanCards,
} from "../helpers/funnel";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";
import {
  LONG_TASK_INIT_SCRIPT,
  readLongTasks,
  resetLongTasks,
  summarizeLongTasks,
} from "../helpers/funnelLongTasks";
import {
  RENDER_PROFILE_INIT_SCRIPT,
  readRenderProfileCounters,
  resetRenderProfileCounters,
} from "../helpers/funnelRenderProfile";
import { collectRenderProfile } from "../helpers/funnelPerf";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const REPORT_JSON = path.join(PERF_DIR, "render-profile-report.json");

/**
 * Perfil de render durante troca Lista → Kanban (G2 causal).
 */
test.describe("@perf @diagnosis Funil — render profile", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(LONG_TASK_INIT_SCRIPT);
    await page.addInitScript(RENDER_PROFILE_INIT_SCRIPT);
  });

  test("DOM vs visível, long tasks e ms/card na volta Lista → Kanban", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards");

    await clickKanbanListViewToggle(page);
    await page.getByRole("table").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(500);

    await resetLongTasks(page);
    await resetRenderProfileCounters(page);

    const t0 = Date.now();
    await returnToKanbanViewMode(page);
    await waitForKanbanReady(page);
    const switchMs = Date.now() - t0;

    const visibleCards = await countVisibleKanbanCards(page);
    const longTasks = summarizeLongTasks(await readLongTasks(page));
    const counters = await readRenderProfileCounters(page);
    const renderProfile = await collectRenderProfile(page, switchMs, visibleCards);

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL,
      scenario: "view_list_to_kanban",
      switchMs,
      visibleKanbanCards: visibleCards,
      renderProfile: {
        ...renderProfile,
        longTasks: {
          count: longTasks.count,
          totalMs: Math.round(longTasks.totalMs),
          maxMs: Math.round(longTasks.maxMs),
          over200ms: longTasks.over200ms,
        },
        layoutShifts: counters.layoutShifts,
        slowFrames: counters.slowFrames,
      },
      hypothesis:
        renderProfile.domLeadCardCount > renderProfile.visibleLeadCardCount * 2
          ? "Colunas off-screen montam cards no DOM — virtualização horizontal ajuda"
          : "G2 provável em hidratação/render dos cards visíveis",
    };

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf-8");

    test.info().attach("render-profile-json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    expect(renderProfile.msPerCard).toBeLessThan(
      Number(process.env.FUNNEL_MS_PER_CARD_MAX ?? "400")
    );
    expect(renderProfile.domLeadCardCount).toBeGreaterThan(0);
  });
});
