import { test, expect } from "@playwright/test";
import {
  clickKanbanListViewToggle,
  returnToKanbanViewMode,
  clickSidebarView,
  countVisibleKanbanCards,
  gotoFunnelPage,
  waitForKanbanReady,
} from "../helpers/funnel";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";
import {
  assertAgainstThresholds,
  buildFunnelPerfReport,
  formatPerfSummary,
  getCriticalDiagnoses,
  loadFunnelPerfBaseline,
  measureInitialKanbanLoad,
  measureReturnToKanban,
  writeFunnelPerfReport,
  waitForCallsView,
  waitForListView,
  formatDiagnosisMarkdown,
} from "../helpers/funnelPerf";

/**
 * Mede tempo e tráfego ao voltar ao funil após trocar de aba/view.
 *
 * Credenciais: E2E_EMAIL, E2E_PASSWORD
 * FUNNEL_PERF_STRICT=1 — falha em critical, limites absolutos e regressão vs baseline
 */
test.describe("@perf @performance Funil — troca de abas (baseline)", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("mede primeira carga, volta após Ligações e Kanban ↔ Lista", async ({
    page,
    baseURL,
  }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local (veja .env.e2e.example).");

    await gotoFunnelPage(page);
    const cardsOnLoad = await countVisibleKanbanCards(page);
    if (cardsOnLoad === 0) {
      await page.waitForTimeout(5000);
    }
    const cardsAfterWait = await countVisibleKanbanCards(page);
    test.skip(
      cardsAfterWait === 0,
      "Funil sem cards visíveis — use conta E2E com leads no pipeline."
    );

    const baseline = loadFunnelPerfBaseline();
    const baselineByScenario = new Map(
      (baseline?.samples ?? []).map((s) => [s.scenario, s])
    );

    const samples = [];

    samples.push(await measureInitialKanbanLoad(page, "first_load_kanban"));

    await page.waitForTimeout(800);

    samples.push(
      await measureReturnToKanban(
        page,
        "sidebar_calls_to_kanban",
        {
          leaveView: async () => {
            await clickSidebarView(page, "Fila de Ligações");
            await waitForCallsView(page);
          },
        },
        baselineByScenario.get("sidebar_calls_to_kanban")
      )
    );

    await clickSidebarView(page, "Funil de Vendas");
    await waitForKanbanReady(page);
    await page.waitForTimeout(400);

    samples.push(
      await measureReturnToKanban(
        page,
        "view_list_to_kanban",
        {
          leaveView: async () => {
            await clickKanbanListViewToggle(page);
            await waitForListView(page);
          },
          returnToKanban: async () => {
            await returnToKanbanViewMode(page);
          },
        },
        baselineByScenario.get("view_list_to_kanban")
      )
    );

    const report = buildFunnelPerfReport(baseURL ?? "", samples);
    const reportPath = writeFunnelPerfReport(report);
    const summary = formatPerfSummary(report);
    const diagnosisMd = formatDiagnosisMarkdown(report);

    console.log("\n" + summary);
    console.log(`JSON: ${reportPath}\n`);

    await test.info().attach("funnel-perf-summary", {
      body: summary,
      contentType: "text/plain",
    });
    await test.info().attach("funnel-perf-json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    await test.info().attach("funnel-perf-diagnosis", {
      body: diagnosisMd,
      contentType: "text/markdown",
    });

    const regressions: string[] = [];
    if (baseline) {
      for (const sample of samples) {
        const base = baseline.samples.find((b) => b.scenario === sample.scenario);
        if (!base) continue;
        const msDelta = sample.returnToKanbanMs - base.returnToKanbanMs;
        if (msDelta > 2000) {
          regressions.push(
            `${sample.scenario}: +${msDelta}ms vs baseline (${base.returnToKanbanMs} → ${sample.returnToKanbanMs})`
          );
        }
        const cqDelta =
          sample.requestsDuringReturn.callQueueByLead -
          base.requestsDuringReturn.callQueueByLead;
        if (cqDelta > 20) {
          regressions.push(
            `${sample.scenario}: +${cqDelta} call_queue/lead vs baseline`
          );
        }
      }
      if (regressions.length > 0) {
        console.warn("Possível regressão vs baseline:\n" + regressions.join("\n"));
      }
    }

    const thresholdFailures = samples.flatMap((s) => assertAgainstThresholds(s));
    if (thresholdFailures.length > 0) {
      console.warn("Limites absolutos excedidos:\n" + thresholdFailures.join("\n"));
    }

    const critical = getCriticalDiagnoses(report);

    if (process.env.FUNNEL_PERF_STRICT === "1") {
      expect(regressions, regressions.join("\n")).toHaveLength(0);
      expect(thresholdFailures, thresholdFailures.join("\n")).toHaveLength(0);
      expect(critical, critical.map((c) => c.message).join("\n")).toHaveLength(0);
    }

    expect(samples.length).toBe(3);
    for (const s of samples) {
      expect(s.returnToKanbanMs).toBeGreaterThan(0);
      expect(s.visibleKanbanCards).toBeGreaterThan(0);
      expect(s.diagnosis.length).toBeGreaterThan(0);
    }
  });
});
