import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
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
  collectRenderProfile,
  FUNNEL_PERF_BASELINE_HIGH_VOLUME_PATH,
  loadFunnelPerfBaseline,
} from "../helpers/funnelPerf";
import { computeMsPerCard } from "../helpers/funnelRenderProfile";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const SCALING_JSON = path.join(PERF_DIR, "card-scaling-report.json");

test.describe("@perf @diagnosis Funil — escala ms/card", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("ratio ms/card vs baseline (regressão >20%)", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);

    await clickKanbanListViewToggle(page);
    await page.getByRole("table").first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(500);

    const t0 = Date.now();
    await returnToKanbanViewMode(page);
    await waitForKanbanReady(page);
    const switchMs = Date.now() - t0;

    const visibleCards = await countVisibleKanbanCards(page);
    test.skip(visibleCards === 0, "Funil sem cards");

    const msPerCard = computeMsPerCard(switchMs, visibleCards);
    const renderProfile = await collectRenderProfile(page, switchMs, visibleCards);

    const baseline =
      loadFunnelPerfBaseline(FUNNEL_PERF_BASELINE_HIGH_VOLUME_PATH) ??
      loadFunnelPerfBaseline();

    let baselineMsPerCard: number | null = null;
    if (baseline) {
      const sample = baseline.samples.find((s) => s.scenario === "view_list_to_kanban");
      if (sample?.renderProfile?.msPerCard) {
        baselineMsPerCard = sample.renderProfile.msPerCard;
      } else if (sample) {
        baselineMsPerCard = computeMsPerCard(sample.returnToKanbanMs, sample.visibleKanbanCards);
      }
    }

    const maxMsPerCard = Number(process.env.FUNNEL_MS_PER_CARD_MAX ?? "400");
    const regressionPct = Number(process.env.FUNNEL_MS_PER_CARD_REGRESSION_PCT ?? "20");

    let regressionDetected = false;
    if (baselineMsPerCard && baselineMsPerCard > 0) {
      const deltaPct = ((msPerCard - baselineMsPerCard) / baselineMsPerCard) * 100;
      regressionDetected = deltaPct > regressionPct;
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL,
      switchMs,
      visibleKanbanCards: visibleCards,
      msPerCard,
      renderProfile,
      baselineMsPerCard,
      regressionDetected,
      thresholdMsPerCard: maxMsPerCard,
    };

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(SCALING_JSON, JSON.stringify(report, null, 2), "utf-8");

    expect(msPerCard).toBeLessThan(maxMsPerCard);
    if (process.env.FUNNEL_SCALING_STRICT === "1" && regressionDetected) {
      expect(regressionDetected, `Regressão ms/card: ${msPerCard} vs baseline ${baselineMsPerCard}`).toBe(false);
    }
  });
});
