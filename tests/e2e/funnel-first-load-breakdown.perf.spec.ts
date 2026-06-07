import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { gotoFunnelPage, visibleKanbanCards } from "../helpers/funnel";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";
import { createFunnelApiRequestTracker } from "../helpers/funnelPerf";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const REPORT_JSON = path.join(PERF_DIR, "first-load-breakdown.json");

test.describe("@perf @diagnosis Funil — breakdown 1ª carga", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("tempo até 1º card vs enriquecimento e REST categorizado", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    const tracker = createFunnelApiRequestTracker(page);
    const t0 = Date.now();

    await gotoFunnelPage(page);

    await visibleKanbanCards(page).first().waitFor({ state: "visible", timeout: 90_000 });
    const firstCardMs = Date.now() - t0;

    await page.waitForTimeout(Number(process.env.FUNNEL_FIRST_LOAD_SETTLE_MS ?? "8000"));
    const fullLoadMs = Date.now() - t0;

    const requests = tracker.snapshot();
    tracker.dispose();

    const enrichmentMs = fullLoadMs - firstCardMs;

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL,
      firstCardVisibleMs: firstCardMs,
      fullLoadMs,
      enrichmentMs,
      requestsDuringLoad: requests,
      g3Signal: {
        leadsListFull: requests.leadsListFull,
        likelyDoubleFetch: requests.leadsListFull > 1,
      },
      interpretation:
        enrichmentMs > firstCardMs * 2
          ? "Enriquecimento (tags/badges) domina após render progressivo"
          : "1ª pintura e enriquecimento equilibrados",
    };

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf-8");

    expect(firstCardMs).toBeLessThan(Number(process.env.FUNNEL_FIRST_CARD_MS_MAX ?? "15000"));
    expect(requests.leadsListFull).toBeLessThanOrEqual(
      Number(process.env.FUNNEL_FIRST_LOAD_LEADS_FETCH_MAX ?? "2")
    );
  });
});
