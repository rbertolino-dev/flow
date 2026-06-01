import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Page } from "@playwright/test";
import { waitForKanbanReady } from "./funnel";

export type FunnelApiRequestCounts = {
  callQueueByLead: number;
  callQueueOther: number;
  leadsListFull: number;
  leadsById: number;
  scheduledMessages: number;
  tags: number;
  activities: number;
  pipelineStages: number;
  assignees: number;
  totalRest: number;
};

export type FunnelDiagnosisSeverity = "critical" | "high" | "medium" | "low" | "info";

export type FunnelDiagnosis = {
  id: string;
  severity: FunnelDiagnosisSeverity;
  message: string;
  suggestedFix?: string;
};

export type FunnelTabSwitchRatios = {
  callQueuePerCard: number;
  scheduledOverloadRatio: number;
};

export type FunnelTabSwitchSample = {
  scenario: string;
  returnToKanbanMs: number;
  firstCardVisibleMs: number;
  requestsDuringReturn: FunnelApiRequestCounts;
  visibleKanbanCards: number;
  ratios: FunnelTabSwitchRatios;
  diagnosis: FunnelDiagnosis[];
  primaryBottleneck: string | null;
};

export type FunnelPerfReport = {
  generatedAt: string;
  baseURL: string;
  environment?: {
    strictMode: boolean;
    leadCountApprox?: number;
  };
  samples: FunnelTabSwitchSample[];
  reportDiagnosis: FunnelDiagnosis[];
  thresholds: {
    returnToKanbanMsMax: number;
    callQueueByLeadMax: number;
  };
};

const PERF_DIR = path.join(process.cwd(), "test-results/funnel-perf");
export const FUNNEL_PERF_LATEST_PATH = path.join(PERF_DIR, "latest.json");
export const FUNNEL_PERF_BASELINE_PATH = path.join(PERF_DIR, "baseline.json");
export const FUNNEL_PERF_DIAGNOSIS_MD_PATH = path.join(PERF_DIR, "diagnosis-summary.md");

const COUNT_KEYS = [
  "callQueueByLead",
  "callQueueOther",
  "leadsListFull",
  "leadsById",
  "scheduledMessages",
  "tags",
  "activities",
  "pipelineStages",
  "assignees",
  "totalRest",
] as const;

function emptyCounts(): FunnelApiRequestCounts {
  return {
    callQueueByLead: 0,
    callQueueOther: 0,
    leadsListFull: 0,
    leadsById: 0,
    scheduledMessages: 0,
    tags: 0,
    activities: 0,
    pipelineStages: 0,
    assignees: 0,
    totalRest: 0,
  };
}

/** Helper para testes unitários do motor de diagnóstico. */
export function emptyCountsForTest(
  overrides: Partial<FunnelApiRequestCounts> = {}
): FunnelApiRequestCounts {
  return { ...emptyCounts(), ...overrides };
}

function isSingleLeadFilter(url: string): boolean {
  return (
    (/lead_id=eq\.[0-9a-f-]{8,}/i.test(url) || /[?&]id=eq\.[0-9a-f-]{8,}/i.test(url)) &&
    !/lead_id=in\./i.test(url) &&
    !/id=in\./i.test(url)
  );
}

function classifyRestRequest(url: string, method: string, counts: FunnelApiRequestCounts): void {
  if (!url.includes("/rest/v1/")) return;
  const m = method.toUpperCase();
  if (m !== "GET" && m !== "POST" && m !== "HEAD") return;

  counts.totalRest += 1;

  if (url.includes("/call_queue")) {
    if (isSingleLeadFilter(url)) counts.callQueueByLead += 1;
    else counts.callQueueOther += 1;
    return;
  }

  if (/\/rest\/v1\/leads/.test(url)) {
    if (isSingleLeadFilter(url)) {
      counts.leadsById += 1;
      return;
    }
    counts.leadsListFull += 1;
    return;
  }

  if (url.includes("scheduled_messages")) {
    counts.scheduledMessages += 1;
    return;
  }

  if (url.includes("lead_tags") || /\/rest\/v1\/tags/.test(url)) {
    counts.tags += 1;
    return;
  }

  if (url.includes("activities")) {
    counts.activities += 1;
    return;
  }

  if (url.includes("pipeline_stages")) {
    counts.pipelineStages += 1;
    return;
  }

  if (url.includes("lead_assignees") || url.includes("assignee")) {
    counts.assignees += 1;
  }
}

/** Rastreia pedidos REST relevantes para diagnóstico do funil. */
export function createFunnelApiRequestTracker(page: Page) {
  const counts = emptyCounts();

  const handler = (request: { method: () => string; url: () => string }) => {
    classifyRestRequest(request.url(), request.method(), counts);
  };

  page.on("request", handler);

  return {
    snapshot: (): FunnelApiRequestCounts => ({ ...counts }),
    reset: () => {
      for (const key of COUNT_KEYS) {
        counts[key] = 0;
      }
    },
    dispose: () => page.off("request", handler),
  };
}

export function computeRatios(
  requests: FunnelApiRequestCounts,
  visibleKanbanCards: number
): FunnelTabSwitchRatios {
  const cards = Math.max(visibleKanbanCards, 1);
  const scheduledChunksExpected = Math.ceil(cards / 12);
  return {
    callQueuePerCard: requests.callQueueByLead / cards,
    scheduledOverloadRatio:
      requests.scheduledMessages / Math.max(scheduledChunksExpected, 1),
  };
}

const SEVERITY_ORDER: Record<FunnelDiagnosisSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function diagnoseFunnelSample(
  sample: Omit<FunnelTabSwitchSample, "diagnosis" | "primaryBottleneck">,
  baselineSample?: FunnelTabSwitchSample
): { diagnosis: FunnelDiagnosis[]; primaryBottleneck: string | null } {
  const diagnosis: FunnelDiagnosis[] = [];
  const { ratios, requestsDuringReturn: req, returnToKanbanMs, firstCardVisibleMs, visibleKanbanCards } =
    sample;

  if (ratios.callQueuePerCard >= 0.5) {
    diagnosis.push({
      id: "G1",
      severity: "critical",
      message: `~${req.callQueueByLead} requests call_queue/lead para ${visibleKanbanCards} cards (ratio ${ratios.callQueuePerCard.toFixed(2)})`,
      suggestedFix: "C1",
    });
  }

  if (req.leadsListFull >= 1) {
    diagnosis.push({
      id: "G3",
      severity: "high",
      message: `Refetch completo de leads na volta (${req.leadsListFull}x)`,
      suggestedFix: "C3",
    });
  }

  if (returnToKanbanMs > 3000 && ratios.callQueuePerCard < 0.1) {
    diagnosis.push({
      id: "G2",
      severity: "high",
      message: `Lentidão (${returnToKanbanMs}ms) com pouca rede por card — provável remount/render`,
      suggestedFix: "C2",
    });
  }

  if (ratios.scheduledOverloadRatio > 1.5) {
    diagnosis.push({
      id: "G4",
      severity: "medium",
      message: `Excesso de chunks scheduled_messages (${req.scheduledMessages}, ratio ${ratios.scheduledOverloadRatio.toFixed(2)})`,
      suggestedFix: "C3",
    });
  }

  const stabilizeGap = returnToKanbanMs - firstCardVisibleMs;
  if (firstCardVisibleMs > 0 && stabilizeGap > 2000 && ratios.callQueuePerCard < 0.5) {
    diagnosis.push({
      id: "G2b",
      severity: "medium",
      message: `Cards visíveis em ${firstCardVisibleMs}ms mas funil estabiliza em ${returnToKanbanMs}ms (+${stabilizeGap}ms)`,
      suggestedFix: "C2",
    });
  }

  if (baselineSample) {
    const msDelta = returnToKanbanMs - baselineSample.returnToKanbanMs;
    if (msDelta > 2000) {
      diagnosis.push({
        id: "REG-T",
        severity: "high",
        message: `Regressão de tempo: +${msDelta}ms vs baseline (${baselineSample.returnToKanbanMs} → ${returnToKanbanMs})`,
      });
    }
    const cqDelta = req.callQueueByLead - baselineSample.requestsDuringReturn.callQueueByLead;
    if (cqDelta > 20) {
      diagnosis.push({
        id: "REG-CQ",
        severity: "high",
        message: `Regressão N+1: +${cqDelta} call_queue/lead vs baseline`,
      });
    }
  }

  if (diagnosis.length === 0) {
    diagnosis.push({
      id: "OK",
      severity: "info",
      message: "Nenhum gargalo crítico detectado neste cenário",
    });
  }

  diagnosis.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const primary =
    diagnosis.find((d) => d.severity === "critical" || d.severity === "high")?.id ?? null;

  return { diagnosis, primaryBottleneck: primary };
}

export function aggregateReportDiagnosis(samples: FunnelTabSwitchSample[]): FunnelDiagnosis[] {
  const counts = new Map<string, { count: number; severity: FunnelDiagnosisSeverity; message: string }>();

  for (const sample of samples) {
    for (const d of sample.diagnosis) {
      if (d.id === "OK") continue;
      const existing = counts.get(d.id);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(d.id, { count: 1, severity: d.severity, message: d.message });
      }
    }
  }

  const report: FunnelDiagnosis[] = [];
  for (const [id, data] of counts) {
    report.push({
      id,
      severity: data.severity,
      message: `${id} em ${data.count}/${samples.length} cenário(s)`,
      suggestedFix: id.startsWith("G") ? (id === "G1" ? "C1" : id === "G2" || id === "G2b" ? "C2" : "C3") : undefined,
    });
  }

  report.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return report;
}

function enrichSample(
  partial: Omit<FunnelTabSwitchSample, "ratios" | "diagnosis" | "primaryBottleneck">,
  baselineSample?: FunnelTabSwitchSample
): FunnelTabSwitchSample {
  const ratios = computeRatios(partial.requestsDuringReturn, partial.visibleKanbanCards);
  const { diagnosis, primaryBottleneck } = diagnoseFunnelSample(
    { ...partial, ratios },
    baselineSample
  );
  return { ...partial, ratios, diagnosis, primaryBottleneck };
}

export async function clickSidebarView(page: Page, label: string): Promise<void> {
  const btn = page.getByRole("button", { name: label, exact: true });
  await btn.first().click();
}

export async function waitForCallsView(page: Page): Promise<void> {
  await page.getByRole("heading", { name: /fila de ligações/i }).waitFor({
    state: "visible",
    timeout: 45_000,
  });
}

export async function waitForListView(page: Page): Promise<void> {
  await page.getByRole("table").first().waitFor({ state: "visible", timeout: 45_000 });
}

async function measureKanbanVisiblePhases(
  page: Page,
  navigateToKanban: () => Promise<void>
): Promise<{ firstCardVisibleMs: number; returnToKanbanMs: number }> {
  const t0 = Date.now();
  await navigateToKanban();

  await page.locator("[data-kanban-sortable-item]").first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
  const firstCardVisibleMs = Date.now() - t0;

  await waitForKanbanReady(page);
  const returnToKanbanMs = Date.now() - t0;

  return { firstCardVisibleMs, returnToKanbanMs };
}

/** Primeira carga do funil após login (sem trocar de aba antes). */
export async function measureInitialKanbanLoad(
  page: Page,
  scenario: string
): Promise<FunnelTabSwitchSample> {
  const tracker = createFunnelApiRequestTracker(page);
  tracker.reset();

  const { firstCardVisibleMs, returnToKanbanMs } = await measureKanbanVisiblePhases(page, async () => {
    await waitForKanbanReady(page);
  });

  const visibleKanbanCards = await page.locator("[data-kanban-sortable-item]").count();
  const partial = {
    scenario,
    returnToKanbanMs,
    firstCardVisibleMs,
    requestsDuringReturn: tracker.snapshot(),
    visibleKanbanCards,
  };
  tracker.dispose();
  return enrichSample(partial);
}

export async function measureReturnToKanban(
  page: Page,
  scenario: string,
  options: { leaveView: () => Promise<void>; settleMs?: number },
  baselineSample?: FunnelTabSwitchSample
): Promise<FunnelTabSwitchSample> {
  const tracker = createFunnelApiRequestTracker(page);
  const settleMs = options.settleMs ?? 600;

  await options.leaveView();
  await page.waitForTimeout(settleMs);

  tracker.reset();

  const { firstCardVisibleMs, returnToKanbanMs } = await measureKanbanVisiblePhases(page, async () => {
    await clickSidebarView(page, "Funil de Vendas");
  });

  const visibleKanbanCards = await page.locator("[data-kanban-sortable-item]").count();

  const partial = {
    scenario,
    returnToKanbanMs,
    firstCardVisibleMs,
    requestsDuringReturn: tracker.snapshot(),
    visibleKanbanCards,
  };

  tracker.dispose();
  return enrichSample(partial, baselineSample);
}

export function readPerfThresholds(): { returnToKanbanMsMax: number; callQueueByLeadMax: number } {
  return {
    returnToKanbanMsMax: Number(process.env.FUNNEL_RETURN_KANBAN_MS_MAX ?? "12000"),
    callQueueByLeadMax: Number(process.env.FUNNEL_CALL_QUEUE_BY_LEAD_MAX ?? "80"),
  };
}

export function formatDiagnosisMarkdown(report: FunnelPerfReport): string {
  const lines = [
    `# Diagnóstico funil — ${report.generatedAt}`,
    "",
    `URL: ${report.baseURL}`,
    "",
    "## Resumo global",
    "",
  ];

  for (const d of report.reportDiagnosis) {
    lines.push(`- **[${d.severity}] ${d.id}:** ${d.message}${d.suggestedFix ? ` → fix ${d.suggestedFix}` : ""}`);
  }

  lines.push("", "## Por cenário", "");

  for (const s of report.samples) {
    lines.push(`### ${s.scenario}`);
    lines.push(`- Volta ao Kanban: **${s.returnToKanbanMs} ms** (1º card: ${s.firstCardVisibleMs} ms)`);
    lines.push(`- Cards visíveis: ${s.visibleKanbanCards}`);
    lines.push(`- callQueuePerCard: **${s.ratios.callQueuePerCard.toFixed(3)}**`);
    lines.push(`- Gargalo principal: **${s.primaryBottleneck ?? "—"}**`);
    lines.push("");
    lines.push("| Métrica | Valor |");
    lines.push("|---------|-------|");
    lines.push(`| call_queue/lead | ${s.requestsDuringReturn.callQueueByLead} |`);
    lines.push(`| call_queue/outros | ${s.requestsDuringReturn.callQueueOther} |`);
    lines.push(`| leads (lista) | ${s.requestsDuringReturn.leadsListFull} |`);
    lines.push(`| scheduled_messages | ${s.requestsDuringReturn.scheduledMessages} |`);
    lines.push(`| tags | ${s.requestsDuringReturn.tags} |`);
    lines.push(`| total REST | ${s.requestsDuringReturn.totalRest} |`);
    lines.push("");
    for (const d of s.diagnosis) {
      lines.push(`- [${d.severity}] ${d.id}: ${d.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildFunnelPerfReport(
  baseURL: string,
  samples: FunnelTabSwitchSample[]
): FunnelPerfReport {
  const leadCountApprox = Math.max(...samples.map((s) => s.visibleKanbanCards), 0);
  return {
    generatedAt: new Date().toISOString(),
    baseURL,
    environment: {
      strictMode: process.env.FUNNEL_PERF_STRICT === "1",
      leadCountApprox,
    },
    samples,
    reportDiagnosis: aggregateReportDiagnosis(samples),
    thresholds: readPerfThresholds(),
  };
}

export function writeFunnelPerfReport(report: FunnelPerfReport): string {
  mkdirSync(PERF_DIR, { recursive: true });
  const json = JSON.stringify(report, null, 2);
  writeFileSync(FUNNEL_PERF_LATEST_PATH, json, "utf-8");
  writeFileSync(FUNNEL_PERF_DIAGNOSIS_MD_PATH, formatDiagnosisMarkdown(report), "utf-8");
  return FUNNEL_PERF_LATEST_PATH;
}

export function loadFunnelPerfBaseline(): FunnelPerfReport | null {
  try {
    const raw = readFileSync(FUNNEL_PERF_BASELINE_PATH, "utf-8");
    return JSON.parse(raw) as FunnelPerfReport;
  } catch {
    return null;
  }
}

export function assertAgainstThresholds(
  sample: FunnelTabSwitchSample,
  thresholds = readPerfThresholds()
): string[] {
  const failures: string[] = [];
  if (sample.returnToKanbanMs > thresholds.returnToKanbanMsMax) {
    failures.push(
      `${sample.scenario}: volta ao Kanban ${sample.returnToKanbanMs}ms > ${thresholds.returnToKanbanMsMax}ms`
    );
  }
  if (sample.requestsDuringReturn.callQueueByLead > thresholds.callQueueByLeadMax) {
    failures.push(
      `${sample.scenario}: call_queue por lead ${sample.requestsDuringReturn.callQueueByLead} > ${thresholds.callQueueByLeadMax}`
    );
  }
  return failures;
}

export function getCriticalDiagnoses(report: FunnelPerfReport): FunnelDiagnosis[] {
  const ids = new Set<string>();
  const out: FunnelDiagnosis[] = [];
  for (const s of report.samples) {
    for (const d of s.diagnosis) {
      if (d.severity === "critical" && !ids.has(`${s.scenario}-${d.id}`)) {
        ids.add(`${s.scenario}-${d.id}`);
        out.push({ ...d, message: `${s.scenario}: ${d.message}` });
      }
    }
  }
  return out;
}

export function formatPerfSummary(report: FunnelPerfReport): string {
  const lines = [
    `Relatório funil — ${report.generatedAt}`,
    `URL: ${report.baseURL}`,
    "",
  ];

  if (report.reportDiagnosis.length > 0) {
    lines.push("Gargalos globais:");
    for (const d of report.reportDiagnosis) {
      lines.push(`  [${d.severity}] ${d.id}: ${d.message}`);
    }
    lines.push("");
  }

  for (const s of report.samples) {
    const req = s.requestsDuringReturn;
    lines.push(
      `• ${s.scenario} (primary: ${s.primaryBottleneck ?? "—"})`,
      `  volta ao Kanban: ${s.returnToKanbanMs} ms | 1º card: ${s.firstCardVisibleMs} ms`,
      `  cards: ${s.visibleKanbanCards} | callQueue/card: ${s.ratios.callQueuePerCard.toFixed(3)}`,
      `  REST: cq/lead=${req.callQueueByLead}, cq/outros=${req.callQueueOther}, leads=${req.leadsListFull}, sched=${req.scheduledMessages}, tags=${req.tags}, total=${req.totalRest}`,
      ""
    );
  }
  return lines.join("\n");
}
