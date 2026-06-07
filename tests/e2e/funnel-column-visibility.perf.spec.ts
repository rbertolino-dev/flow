import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
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
import { countDomLeadCards } from "../helpers/funnelRenderProfile";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const REPORT_JSON = path.join(PERF_DIR, "column-visibility-report.json");

test.describe("@perf @diagnosis Funil — scroll horizontal colunas", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(LONG_TASK_INIT_SCRIPT);
  });

  test("scroll até última coluna mede long tasks e DOM cards", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards");

    const scrollContainer = page.locator(".kanban-scroll").first();
    await scrollContainer.waitFor({ state: "visible", timeout: 30_000 });

    await resetLongTasks(page);
    const t0 = Date.now();

    await scrollContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await page.waitForTimeout(800);

    const scrollMs = Date.now() - t0;
    const domBeforeEnd = await countDomLeadCards(page);
    const longTasks = summarizeLongTasks(await readLongTasks(page));

    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await page.waitForTimeout(400);
    const domAfterReset = await countDomLeadCards(page);

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL,
      scrollToEndMs: scrollMs,
      domLeadCardCountAtEnd: domBeforeEnd,
      domLeadCardCountAfterReset: domAfterReset,
      visibleKanbanCards: cards,
      longTasks: {
        count: longTasks.count,
        totalMs: Math.round(longTasks.totalMs),
        maxMs: Math.round(longTasks.maxMs),
      },
    };

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf-8");

    expect(scrollMs).toBeLessThan(Number(process.env.FUNNEL_COLUMN_SCROLL_MS_MAX ?? "15000"));
  });
});
