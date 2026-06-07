import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
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
  buildFunnelPerfReport,
  measureInitialKanbanLoad,
  measureReturnToKanban,
  waitForCallsView,
  waitForListView,
} from "../helpers/funnelPerf";
import {
  buildDiagnosisValidationReport,
  formatValidationMarkdown,
  strictValidationFailures,
  type OutageRecoverySnapshot,
} from "../helpers/funnelDiagnosisValidation";

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
const VALIDATION_JSON = path.join(PERF_DIR, "validation-report.json");
const VALIDATION_MD = path.join(PERF_DIR, "validation-report.md");
const OUTAGE_JSON = path.join(PERF_DIR, "outage-recovery.json");

function loadOutageSnapshot(): OutageRecoverySnapshot | null {
  if (!existsSync(OUTAGE_JSON)) return null;
  try {
    const raw = JSON.parse(readFileSync(OUTAGE_JSON, "utf-8")) as {
      outageDurationMs: number;
      preOutage: { returnToKanbanMs: number };
      postOutage: { returnToKanbanMs: number };
      requestsDuringRecovery: { totalRest: number };
      deltaReturnMs: number;
    };
    return {
      outageDurationMs: raw.outageDurationMs,
      preOutageReturnMs: raw.preOutage.returnToKanbanMs,
      postOutageReturnMs: raw.postOutage.returnToKanbanMs,
      requestsDuringRecovery: raw.requestsDuringRecovery.totalRest,
      deltaReturnMs: raw.deltaReturnMs,
    };
  } catch {
    return null;
  }
}

/**
 * Suíte de validação: mede cenários do funil e emite vereditos CONFIRMADO/REFUTADO
 * por hipótese (G1–G4 + tempestade pós-outage).
 *
 * Pré-requisito opcional para OUTAGE_STORM: npm run test:e2e:funnel-outage antes
 * ou FUNNEL_VALIDATION_INCLUDE_OUTAGE=1 (este spec não roda outage inline — evita 3min+).
 */
test.describe("@perf @validation Validação do diagnóstico G1–G4", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("mede cenários e gera validation-report com vereditos", async ({ page, baseURL }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    const cards = await countVisibleKanbanCards(page);
    test.skip(cards === 0, "Funil sem cards na conta E2E");

    const samples = [];

    samples.push(await measureInitialKanbanLoad(page, "first_load_kanban"));
    await page.waitForTimeout(600);

    samples.push(
      await measureReturnToKanban(page, "sidebar_calls_to_kanban", {
        leaveView: async () => {
          await clickSidebarView(page, "Fila de Ligações");
          await waitForCallsView(page);
        },
      })
    );

    await clickSidebarView(page, "Funil de Vendas");
    await waitForKanbanReady(page);
    await page.waitForTimeout(400);

    samples.push(
      await measureReturnToKanban(page, "view_list_to_kanban", {
        leaveView: async () => {
          await clickKanbanListViewToggle(page);
          await waitForListView(page);
        },
        returnToKanban: async () => {
          await returnToKanbanViewMode(page);
        },
      })
    );

    const perfReport = buildFunnelPerfReport(baseURL ?? "", samples);
    const outage = loadOutageSnapshot();
    const validation = buildDiagnosisValidationReport(perfReport, outage);
    const md = formatValidationMarkdown(validation);

    mkdirSync(PERF_DIR, { recursive: true });
    writeFileSync(VALIDATION_JSON, JSON.stringify(validation, null, 2));
    writeFileSync(VALIDATION_MD, md);

    console.log("\n" + md);
    console.log(`JSON: ${VALIDATION_JSON}\n`);

    await test.info().attach("validation-report", {
      body: md,
      contentType: "text/markdown",
    });
    await test.info().attach("validation-json", {
      body: JSON.stringify(validation, null, 2),
      contentType: "application/json",
    });

    if (!outage) {
      console.warn(
        "OUTAGE_STORM: N/A — rode `npm run test:e2e:funnel-outage` antes para validar hipótese pós-falha Supabase"
      );
    }

    const strictFailures = strictValidationFailures(validation);
    if (process.env.FUNNEL_VALIDATION_STRICT === "1") {
      expect(strictFailures, strictFailures.join("\n")).toHaveLength(0);
    }

    // Asserções mínimas: o motor deve conseguir classificar o cenário real
    expect(validation.verdicts.length).toBe(5);

    const g2 = validation.verdicts.find((v) => v.id === "G2");
    expect(g2?.status).toBe("confirmed");

    const g1 = validation.verdicts.find((v) => v.id === "G1");
    expect(g1?.status).toBe("rejected");
  });
});
