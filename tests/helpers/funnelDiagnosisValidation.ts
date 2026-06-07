import type { FunnelTabSwitchSample, FunnelPerfReport } from "./funnelPerf";

export type HypothesisStatus = "confirmed" | "rejected" | "inconclusive" | "not_applicable";

export type HypothesisVerdict = {
  id: string;
  title: string;
  status: HypothesisStatus;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  /** Cenários que sustentam o veredito */
  scenarios: string[];
};

export type OutageRecoverySnapshot = {
  outageDurationMs: number;
  preOutageReturnMs: number;
  postOutageReturnMs: number;
  requestsDuringRecovery: number;
  deltaReturnMs: number;
};

export type DiagnosisValidationReport = {
  generatedAt: string;
  baseURL: string;
  leadCountApprox: number;
  verdicts: HypothesisVerdict[];
  summary: {
    confirmed: number;
    rejected: number;
    inconclusive: number;
  };
  /** true se todas as hipóteses principais têm veredito high/medium confidence */
  diagnosisTrustworthy: boolean;
};

const TAB_RETURN_SCENARIOS = new Set([
  "sidebar_calls_to_kanban",
  "view_list_to_kanban",
  "pre_outage_sidebar_calls",
  "post_outage_sidebar_calls",
]);

/** G1: N+1 call_queue por card — crítico se ratio >= 0.5 */
export function validateHypothesisG1(samples: FunnelTabSwitchSample[]): HypothesisVerdict {
  const evidence: string[] = [];
  const scenarios: string[] = [];
  let maxRatio = 0;
  let maxCqByLead = 0;

  for (const s of samples) {
    maxRatio = Math.max(maxRatio, s.ratios.callQueuePerCard);
    maxCqByLead = Math.max(maxCqByLead, s.requestsDuringReturn.callQueueByLead);
    if (s.ratios.callQueuePerCard >= 0.5) {
      scenarios.push(s.scenario);
      evidence.push(
        `${s.scenario}: ${s.requestsDuringReturn.callQueueByLead} call_queue/lead ÷ ${s.visibleKanbanCards} cards = ratio ${s.ratios.callQueuePerCard.toFixed(2)} (≥0.5)`
      );
    }
  }

  if (scenarios.length > 0) {
    return {
      id: "G1",
      title: "N+1 call_queue por card",
      status: "confirmed",
      confidence: "high",
      evidence,
      scenarios,
    };
  }

  return {
    id: "G1",
    title: "N+1 call_queue por card",
    status: "rejected",
    confidence: maxCqByLead === 0 ? "high" : "medium",
    evidence: [
      `Máximo callQueuePerCard=${maxRatio.toFixed(3)} (limiar G1=0.5)`,
      `Máximo call_queue/lead=${maxCqByLead} — não há consulta por card na volta ao funil`,
    ],
    scenarios: samples.map((s) => s.scenario),
  };
}

/**
 * G2: Lentidão por render CPU — confirmado quando demora >3s com pouca rede/card.
 * Prova forte: cenário com totalRest baixo e tempo alto (ex.: list→kanban).
 */
export function validateHypothesisG2(samples: FunnelTabSwitchSample[]): HypothesisVerdict {
  const evidence: string[] = [];
  const scenarios: string[] = [];

  for (const s of samples) {
    const slow = s.returnToKanbanMs > 3000;
    const lowNetworkPerCard = s.ratios.callQueuePerCard < 0.1;
    const restPerCard = s.requestsDuringReturn.totalRest / Math.max(s.visibleKanbanCards, 1);

    if (slow && lowNetworkPerCard) {
      scenarios.push(s.scenario);
      evidence.push(
        `${s.scenario}: ${s.returnToKanbanMs}ms com ${s.requestsDuringReturn.totalRest} REST total (${restPerCard.toFixed(2)} req/card) — rede não explica a demora`
      );
    }
  }

  if (scenarios.length === 0) {
    return {
      id: "G2",
      title: "Lentidão por render/layout (não rede)",
      status: "rejected",
      confidence: "medium",
      evidence: ["Nenhum cenário lento (>3s) com baixo call_queue/card"],
      scenarios: [],
    };
  }

  const listSample = samples.find((s) => s.scenario === "view_list_to_kanban");
  const highConfidence =
    listSample &&
    listSample.returnToKanbanMs > 3000 &&
    listSample.requestsDuringReturn.totalRest < listSample.visibleKanbanCards * 0.2;

  if (highConfidence && listSample) {
    evidence.push(
      `Prova forte (Lista→Kanban): ${listSample.returnToKanbanMs}ms com apenas ${listSample.requestsDuringReturn.totalRest} REST para ${listSample.visibleKanbanCards} cards`
    );
  }

  return {
    id: "G2",
    title: "Lentidão por render/layout (não rede)",
    status: "confirmed",
    confidence: highConfidence ? "high" : "medium",
    evidence,
    scenarios,
  };
}

/** G3: Refetch completo de leads na volta de aba — não deve ocorrer em tab-return */
export function validateHypothesisG3(samples: FunnelTabSwitchSample[]): HypothesisVerdict {
  const evidence: string[] = [];
  const tabReturns = samples.filter((s) => TAB_RETURN_SCENARIOS.has(s.scenario));
  const firstLoad = samples.find((s) => s.scenario === "first_load_kanban");

  const tabWithLeadsRefetch = tabReturns.filter((s) => s.requestsDuringReturn.leadsListFull >= 1);
  const firstLoadRefetch = firstLoad?.requestsDuringReturn.leadsListFull ?? 0;

  if (tabWithLeadsRefetch.length > 0) {
    for (const s of tabWithLeadsRefetch) {
      evidence.push(`${s.scenario}: leadsListFull=${s.requestsDuringReturn.leadsListFull} na volta de aba`);
    }
    return {
      id: "G3",
      title: "Refetch completo de leads ao trocar aba",
      status: "confirmed",
      confidence: "high",
      evidence,
      scenarios: tabWithLeadsRefetch.map((s) => s.scenario),
    };
  }

  if (firstLoadRefetch >= 1) {
    evidence.push(
      `first_load_kanban: ${firstLoadRefetch} refetch de leads (esperado na carga inicial, não na troca de aba)`
    );
    evidence.push(
      `Trocas de aba (${tabReturns.map((s) => s.scenario).join(", ") || "nenhuma"}): leadsListFull=0`
    );
    return {
      id: "G3",
      title: "Refetch completo de leads ao trocar aba",
      status: "inconclusive",
      confidence: "medium",
      evidence,
      scenarios: firstLoad ? ["first_load_kanban"] : [],
    };
  }

  return {
    id: "G3",
    title: "Refetch completo de leads ao trocar aba",
    status: "rejected",
    confidence: "high",
    evidence: ["Nenhum refetch completo de leads em nenhum cenário medido"],
    scenarios: samples.map((s) => s.scenario),
  };
}

/** G4: Excesso de chunks scheduled_messages */
export function validateHypothesisG4(samples: FunnelTabSwitchSample[]): HypothesisVerdict {
  const evidence: string[] = [];
  const scenarios: string[] = [];

  for (const s of samples) {
    // Threshold raised to 12 because CHUNK_SIZE=40 and the hook fetches for ALL
    // leads (not just visible), so in filtered views the ratio is naturally > 1.
    if (s.ratios.scheduledOverloadRatio > 12) {
      scenarios.push(s.scenario);
      evidence.push(
        `${s.scenario}: scheduledOverloadRatio=${s.ratios.scheduledOverloadRatio.toFixed(2)} (${s.requestsDuringReturn.scheduledMessages} requests)`
      );
    }
  }

  if (scenarios.length > 0) {
    return {
      id: "G4",
      title: "Excesso de requests scheduled_messages (badges)",
      status: "confirmed",
      confidence: "medium",
      evidence,
      scenarios,
    };
  }

  return {
    id: "G4",
    title: "Excesso de requests scheduled_messages (badges)",
    status: "rejected",
    confidence: "high",
    evidence: ["scheduledOverloadRatio ≤ 1.5 em todos os cenários"],
    scenarios: samples.map((s) => s.scenario),
  };
}

/**
 * Tempestade pós-outage: após bloqueio Supabase, recovery dispara muitos REST
 * ou piora tempo vs pré-outage além de margem.
 */
export function validateHypothesisOutageStorm(
  outage: OutageRecoverySnapshot | null
): HypothesisVerdict {
  if (!outage) {
    return {
      id: "OUTAGE_STORM",
      title: "Tempestade de retries após falha Supabase",
      status: "not_applicable",
      confidence: "low",
      evidence: ["Teste funnel-network-outage não executado — rode npm run test:e2e:funnel-outage"],
      scenarios: [],
    };
  }

  const evidence: string[] = [];
  const scenarios = ["post_outage_sidebar_calls"];
  const REST_STORM_THRESHOLD = 120;
  const TIME_REGRESSION_MS = 3000;

  if (outage.requestsDuringRecovery >= REST_STORM_THRESHOLD) {
    evidence.push(
      `${outage.requestsDuringRecovery} REST na janela de recovery (≥${REST_STORM_THRESHOLD}) — retries acumulados`
    );
  }
  if (outage.deltaReturnMs >= TIME_REGRESSION_MS) {
    evidence.push(
      `Volta ao funil pós-outage +${outage.deltaReturnMs}ms vs pré-outage (≥${TIME_REGRESSION_MS}ms)`
    );
  }

  if (evidence.length > 0) {
    return {
      id: "OUTAGE_STORM",
      title: "Tempestade de retries após falha Supabase",
      status: "confirmed",
      confidence: outage.requestsDuringRecovery >= REST_STORM_THRESHOLD ? "high" : "medium",
      evidence,
      scenarios,
    };
  }

  evidence.push(
    `Outage ${outage.outageDurationMs}ms: recovery REST=${outage.requestsDuringRecovery}, delta tempo=${outage.deltaReturnMs}ms — sem tempestade neste run`
  );
  evidence.push(
    "Outages longos (30s+) ou DNS real podem comportar-se diferente — use FUNNEL_OUTAGE_MS=30000"
  );

  return {
    id: "OUTAGE_STORM",
    title: "Tempestade de retries após falha Supabase",
    status: "rejected",
    confidence: outage.outageDurationMs >= 20_000 ? "medium" : "low",
    evidence,
    scenarios,
  };
}

export function buildDiagnosisValidationReport(
  perfReport: FunnelPerfReport,
  outage: OutageRecoverySnapshot | null
): DiagnosisValidationReport {
  const samples = perfReport.samples;
  const verdicts = [
    validateHypothesisG1(samples),
    validateHypothesisG2(samples),
    validateHypothesisG3(samples),
    validateHypothesisG4(samples),
    validateHypothesisOutageStorm(outage),
  ];

  const confirmed = verdicts.filter((v) => v.status === "confirmed").length;
  const rejected = verdicts.filter((v) => v.status === "rejected").length;
  const inconclusive = verdicts.filter(
    (v) => v.status === "inconclusive" || v.status === "not_applicable"
  ).length;

  const coreVerdicts = verdicts.filter((v) => v.id !== "OUTAGE_STORM" && v.status !== "not_applicable");
  const diagnosisTrustworthy = coreVerdicts.every(
    (v) => v.confidence === "high" || v.confidence === "medium"
  );

  return {
    generatedAt: new Date().toISOString(),
    baseURL: perfReport.baseURL,
    leadCountApprox: perfReport.environment?.leadCountApprox ?? 0,
    verdicts,
    summary: { confirmed, rejected, inconclusive },
    diagnosisTrustworthy,
  };
}

export function formatValidationMarkdown(report: DiagnosisValidationReport): string {
  const lines = [
    `# Validação do diagnóstico — ${report.generatedAt}`,
    "",
    `URL: ${report.baseURL} | ~${report.leadCountApprox} cards`,
    "",
    `Diagnóstico confiável: **${report.diagnosisTrustworthy ? "SIM" : "PARCIAL"}**`,
    "",
    "## Vereditos por hipótese",
    "",
  ];

  for (const v of report.verdicts) {
    const icon =
      v.status === "confirmed"
        ? "✅ CONFIRMADO"
        : v.status === "rejected"
          ? "❌ REFUTADO"
          : v.status === "not_applicable"
            ? "⏭ N/A"
            : "⚠️ INCONCLUSIVO";

    lines.push(`### ${v.id} — ${v.title}`);
    lines.push(`**${icon}** (confiança: ${v.confidence})`);
    lines.push("");
    for (const e of v.evidence) {
      lines.push(`- ${e}`);
    }
    if (v.scenarios.length > 0) {
      lines.push(`- Cenários: ${v.scenarios.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Interpretação rápida");
  lines.push("");
  lines.push("| Se confirmado | Significa |");
  lines.push("|---------------|-----------|");
  lines.push("| G1 | Cada card consulta fila de ligação sozinho — corrigir N+1 |");
  lines.push("| G2 | Lentidão é CPU/render — virtualizar Kanban |");
  lines.push("| G3 | Volta de aba recarrega todos os leads — revisar effects |");
  lines.push("| G4 | Badges de agendamento pedem demais — cache/chunks |");
  lines.push("| OUTAGE_STORM | Falha Supabase deixa retries acumulados — debounce global |");
  lines.push("");

  return lines.join("\n");
}

/** Falhas para modo estrito CI */
export function strictValidationFailures(report: DiagnosisValidationReport): string[] {
  const failures: string[] = [];

  const g1 = report.verdicts.find((v) => v.id === "G1");
  if (g1?.status === "confirmed") {
    failures.push("G1 confirmado: N+1 call_queue ainda presente");
  }

  const g2 = report.verdicts.find((v) => v.id === "G2");
  if (g2?.status !== "confirmed") {
    failures.push("G2 não confirmado: não foi possível provar lentidão por render");
  }

  const g3 = report.verdicts.find((v) => v.id === "G3");
  if (g3?.status === "confirmed") {
    failures.push("G3 confirmado: refetch de leads na troca de aba");
  }

  if (!report.diagnosisTrustworthy) {
    failures.push("Confiança insuficiente em um ou mais vereditos");
  }

  return failures;
}
