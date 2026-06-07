import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  clickSidebarView,
  gotoFunnelPage,
  waitForKanbanReady,
  countVisibleKanbanCards,
} from "../helpers/funnel";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";
import {
  createFunnelApiRequestTracker,
  loadFunnelPerfBaseline,
  measureReturnToKanban,
  waitForCallsView,
} from "../helpers/funnelPerf";

const OUTAGE_MS = Number(process.env.FUNNEL_OUTAGE_MS ?? 8_000);
const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const OUTAGE_REPORT_PATH = path.join(PERF_DIR, "outage-recovery.json");

function isSupabaseApiUrl(url: string): boolean {
  return (
    url.includes("/rest/v1/") ||
    url.includes("/auth/v1/") ||
    url.includes("/realtime/v1/") ||
    url.includes("/functions/v1/")
  );
}

/**
 * Simula falha DNS/rede/Supabase e mede recuperação + troca de aba depois.
 *
 * E2E_EMAIL / E2E_PASSWORD em .env.e2e.local
 */
test.describe("@perf @performance Funil — recuperação após outage Supabase", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("bloqueia API Supabase, mede recovery e troca Ligações→Funil", async ({
    page,
    baseURL,
  }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local (veja .env.e2e.example).");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards — use conta E2E com leads.");

    const baseline = loadFunnelPerfBaseline();
    const baselineCalls = baseline?.samples.find((s) => s.scenario === "sidebar_calls_to_kanban");

    // Baseline rápido antes do outage (sem bloqueio)
    const preOutage = await measureReturnToKanban(page, "pre_outage_sidebar_calls", {
      leaveView: async () => {
        await clickSidebarView(page, "Fila de Ligações");
        await waitForCallsView(page);
      },
    });

    await clickSidebarView(page, "Funil de Vendas");
    await waitForKanbanReady(page);
    await page.waitForTimeout(400);

    let blockSupabase = false;
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (blockSupabase && isSupabaseApiUrl(url)) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    const tracker = createFunnelApiRequestTracker(page);
    blockSupabase = true;
    const outageStartedAt = Date.now();
    console.log(`⛔ Outage simulado: ${OUTAGE_MS}ms (bloqueio Supabase API)`);

    await page.waitForTimeout(OUTAGE_MS);

    blockSupabase = false;
    const recoveryStartedAt = Date.now();
    tracker.reset();

    // Forçar interação que depende de rede: ir à fila e voltar
    await clickSidebarView(page, "Fila de Ligações");
    await waitForCallsView(page).catch(() => {
      /* durante recovery a fila pode demorar */
    });

    const postOutage = await measureReturnToKanban(
      page,
      "post_outage_sidebar_calls",
      {
        leaveView: async () => {
          /* já estamos na fila */
        },
        returnToKanban: async () => {
          await clickSidebarView(page, "Funil de Vendas");
          await waitForKanbanReady(page);
        },
      },
      baselineCalls
    );

    const recoveryWindowMs = Date.now() - recoveryStartedAt;
    const requestsDuringRecovery = tracker.snapshot();
    tracker.dispose();
    await page.unroute("**/*");

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL: baseURL ?? "",
      outageDurationMs: OUTAGE_MS,
      outageWallMs: Date.now() - outageStartedAt,
      recoveryWindowMs,
      visibleKanbanCards: cards,
      preOutage: {
        returnToKanbanMs: preOutage.returnToKanbanMs,
        totalRest: preOutage.requestsDuringReturn.totalRest,
      },
      postOutage: {
        returnToKanbanMs: postOutage.returnToKanbanMs,
        totalRest: postOutage.requestsDuringReturn.totalRest,
        primaryBottleneck: postOutage.primaryBottleneck,
        diagnosis: postOutage.diagnosis,
      },
      requestsDuringRecovery,
      deltaReturnMs: postOutage.returnToKanbanMs - preOutage.returnToKanbanMs,
      baselineReturnMs: baselineCalls?.returnToKanbanMs ?? null,
      findings: [] as string[],
    };

    if (postOutage.returnToKanbanMs > preOutage.returnToKanbanMs + 3000) {
      report.findings.push(
        `Troca de aba pós-outage +${postOutage.returnToKanbanMs - preOutage.returnToKanbanMs}ms vs pré-outage — possível tempestade de retries/refetch.`
      );
    }
    if (requestsDuringRecovery.totalRest > 120) {
      report.findings.push(
        `${requestsDuringRecovery.totalRest} requests REST na janela de recovery — retries acumulados.`
      );
    }
    if (recoveryWindowMs > OUTAGE_MS + 10_000) {
      report.findings.push(
        `Recovery wall time ${recoveryWindowMs}ms >> outage ${OUTAGE_MS}ms — timeouts/reconnect prolongam estado degradado.`
      );
    }
    if (report.findings.length === 0) {
      report.findings.push("Nenhum sinal forte de degradação pós-outage neste run (org/tamanho podem variar).");
    }

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(OUTAGE_REPORT_PATH, JSON.stringify(report, null, 2));

    console.log("\n=== Outage recovery ===");
    console.log(`Pré-outage volta Funil: ${preOutage.returnToKanbanMs}ms (${preOutage.requestsDuringReturn.totalRest} REST)`);
    console.log(`Pós-outage volta Funil: ${postOutage.returnToKanbanMs}ms (${postOutage.requestsDuringReturn.totalRest} REST)`);
    console.log(`REST na recovery: ${requestsDuringRecovery.totalRest}`);
    console.log(`Relatório: ${OUTAGE_REPORT_PATH}`);
    report.findings.forEach((f) => console.log(`→ ${f}`));

    await test.info().attach("outage-recovery-json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    expect(postOutage.returnToKanbanMs).toBeGreaterThan(0);
    expect(postOutage.visibleKanbanCards).toBeGreaterThan(0);

    if (process.env.FUNNEL_OUTAGE_STRICT === "1") {
      expect(
        postOutage.returnToKanbanMs,
        "Pós-outage não deve exceder pré-outage em >8s"
      ).toBeLessThanOrEqual(preOutage.returnToKanbanMs + 8000);
    }
  });
});
