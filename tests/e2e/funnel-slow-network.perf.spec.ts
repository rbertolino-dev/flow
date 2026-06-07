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
import { createFunnelApiRequestTracker } from "../helpers/funnelPerf";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const SLOW_NETWORK_JSON = path.join(PERF_DIR, "slow-network.json");

const DELAY_MS = Number(process.env.FUNNEL_SLOW_DELAY_MS ?? 12_000);
const OUTAGE_MS = Number(process.env.FUNNEL_SLOW_OUTAGE_MS ?? 20_000);

function isSupabaseApi(url: string): boolean {
  return (
    url.includes("/rest/v1/") ||
    url.includes("/auth/v1/") ||
    url.includes("/realtime/v1/") ||
    url.includes("/functions/v1/")
  );
}

/**
 * Simula rede degradada (latência alta + falha), mais próximo de Nginx timeout / DNS lento.
 */
test.describe("@perf @validation Funil — rede lenta / timeout", () => {
  test.describe.configure({ mode: "serial", timeout: 420_000 });

  test("latência alta nas APIs e mede tempestade na recovery", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards");

    let mode: "normal" | "slow" | "blocked" = "normal";
    const pendingDelays: number[] = [];

    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (!isSupabaseApi(url)) {
        await route.continue();
        return;
      }
      if (mode === "blocked") {
        await route.abort("timedout");
        return;
      }
      if (mode === "slow") {
        await new Promise((r) => setTimeout(r, DELAY_MS));
        try {
          await route.continue();
        } catch {
          pendingDelays.push(DELAY_MS);
        }
        return;
      }
      await route.continue();
    });

    const tracker = createFunnelApiRequestTracker(page);

    // Baseline: troca para ligações
    const t0 = Date.now();
    await clickSidebarView(page, "Fila de Ligações");
    await page.getByRole("heading", { name: /fila de ligações/i }).waitFor({ timeout: 90_000 });
    const baselineSidebarMs = Date.now() - t0;

    await clickSidebarView(page, "Funil de Vendas");
    await waitForKanbanReady(page);

    // Fase lenta: cada request Supabase espera DELAY_MS
    mode = "slow";
    tracker.reset();
    const slowStart = Date.now();
    await clickSidebarView(page, "Fila de Ligações");
    try {
      await page.getByRole("heading", { name: /fila de ligações/i }).waitFor({ timeout: 120_000 });
    } catch {
      /* timeout esperado em rede muito lenta */
    }
    const slowPhaseMs = Date.now() - slowStart;
    const slowRest = tracker.snapshot();

    // Bloqueio total (simula DNS down / Supabase off)
    mode = "blocked";
    await page.waitForTimeout(OUTAGE_MS);
    mode = "normal";

    tracker.reset();
    const recoveryStart = Date.now();
    await clickSidebarView(page, "Funil de Vendas");
    await waitForKanbanReady(page);
    const recoveryMs = Date.now() - recoveryStart;
    const recoveryRest = tracker.snapshot();

    await page.unroute("**/*");

    const report = {
      generatedAt: new Date().toISOString(),
      baseURL: baseURL ?? "",
      config: { delayMs: DELAY_MS, outageMs: OUTAGE_MS },
      visibleKanbanCards: cards,
      baselineSidebarMs,
      slowPhase: { wallMs: slowPhaseMs, ...slowRest },
      recovery: { wallMs: recoveryMs, ...recoveryRest },
      findings: [] as string[],
    };

    if (recoveryRest.totalRest >= 80) {
      report.findings.push(
        `Recovery: ${recoveryRest.totalRest} REST após outage — hipótese OUTAGE_STORM CONFIRMADA neste perfil`
      );
    }
    if (recoveryMs > baselineSidebarMs + 5000) {
      report.findings.push(
        `Recovery ${recoveryMs}ms vs baseline ${baselineSidebarMs}ms — lentidão persistente pós-falha`
      );
    }
    if (slowRest.totalRest >= 30) {
      report.findings.push(
        `Fase lenta: ${slowRest.totalRest} REST com delay ${DELAY_MS}ms — retries/timeouts empilham`
      );
    }
    if (report.findings.length === 0) {
      report.findings.push("Rede lenta simulada não gerou tempestade forte — tentar FUNNEL_SLOW_DELAY_MS=20000");
    }

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(SLOW_NETWORK_JSON, JSON.stringify(report, null, 2));

    console.log("\n=== Rede lenta / timeout ===");
    console.log(JSON.stringify(report, null, 2));
    console.log(`Arquivo: ${SLOW_NETWORK_JSON}`);

    await test.info().attach("slow-network-json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    expect(recoveryMs).toBeGreaterThan(0);
  });
});
