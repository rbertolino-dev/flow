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

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const LONGTASK_JSON = path.join(PERF_DIR, "longtask-report.json");

/**
 * Prova G2 no main thread: long tasks durante troca Lista → Kanban.
 */
test.describe("@perf @validation Funil — long tasks (G2 CPU)", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(LONG_TASK_INIT_SCRIPT);
  });

  test("mede long tasks ao voltar Lista → Kanban", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards");

    await resetLongTasks(page);
    await clickKanbanListViewToggle(page);
    await page.getByRole("table").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(500);

    await resetLongTasks(page);
    const t0 = Date.now();
    await returnToKanbanViewMode(page);
    await waitForKanbanReady(page);
    const switchMs = Date.now() - t0;

    const tasks = await readLongTasks(page);
    const summary = summarizeLongTasks(tasks);

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL: baseURL ?? "",
      scenario: "view_list_to_kanban",
      visibleKanbanCards: cards,
      switchMs,
      longTasks: summary,
      topTasks: [...tasks].sort((a, b) => b.duration - a.duration).slice(0, 10),
      g2CpuEvidence: {
        confirmed:
          switchMs > 3000 &&
          (summary.over200ms >= 1 || summary.totalMs >= 500),
        reason: "",
      },
      findings: [] as string[],
    };

    if (report.g2CpuEvidence.confirmed) {
      report.g2CpuEvidence.reason = `Troca em ${switchMs}ms com ${summary.over200ms} long tasks ≥200ms (total blocking ${summary.totalMs.toFixed(0)}ms)`;
      report.findings.push("G2 CONFIRMADO no main thread — priorizar virtualização / content-visibility no Kanban");
    } else if (switchMs > 3000) {
      report.findings.push(
        `Lento (${switchMs}ms) mas poucos long tasks — investigar layout/paint ou GPU`
      );
    } else {
      report.findings.push("Troca rápida neste run — org menor ou cache quente");
    }

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(LONGTASK_JSON, JSON.stringify(report, null, 2));

    console.log("\n=== Long tasks Lista→Kanban ===");
    console.log(JSON.stringify(report, null, 2));

    await test.info().attach("longtask-report", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    expect(switchMs).toBeGreaterThan(0);
  });
});
