import { test, expect } from "@playwright/test";
import {
  validateHypothesisG1,
  validateHypothesisG2,
  validateHypothesisG3,
  validateHypothesisG4,
  validateHypothesisOutageStorm,
  buildDiagnosisValidationReport,
  strictValidationFailures,
} from "../helpers/funnelDiagnosisValidation";
import { computeRatios, emptyCountsForTest } from "../helpers/funnelPerf";

function sample(
  scenario: string,
  ms: number,
  cards: number,
  req: ReturnType<typeof emptyCountsForTest>
) {
  const requestsDuringReturn = req;
  return {
    scenario,
    returnToKanbanMs: ms,
    firstCardVisibleMs: ms,
    visibleKanbanCards: cards,
    requestsDuringReturn,
    ratios: computeRatios(requestsDuringReturn, cards),
    diagnosis: [],
    primaryBottleneck: null,
  };
}

test.describe("@unit funnelDiagnosisValidation", () => {
  test("G1 confirmado quando ratio call_queue alto", () => {
    const v = validateHypothesisG1([
      sample("x", 2000, 50, emptyCountsForTest({ callQueueByLead: 30 })),
    ]);
    expect(v.status).toBe("confirmed");
    expect(v.id).toBe("G1");
  });

  test("G1 refutado quando zero call_queue por lead", () => {
    const v = validateHypothesisG1([
      sample("x", 8000, 200, emptyCountsForTest()),
    ]);
    expect(v.status).toBe("rejected");
  });

  test("G2 confirmado: lento com poucos REST (prova render)", () => {
    const v = validateHypothesisG2([
      sample("view_list_to_kanban", 15000, 227, emptyCountsForTest({ totalRest: 28 })),
    ]);
    expect(v.status).toBe("confirmed");
    expect(v.confidence).toBe("high");
  });

  test("G3 inconclusivo: refetch só na first_load", () => {
    const v = validateHypothesisG3([
      sample("first_load_kanban", 15000, 200, emptyCountsForTest({ leadsListFull: 1 })),
      sample("sidebar_calls_to_kanban", 7000, 200, emptyCountsForTest()),
    ]);
    expect(v.status).toBe("inconclusive");
  });

  test("G3 confirmado se refetch na troca de aba", () => {
    const v = validateHypothesisG3([
      sample("sidebar_calls_to_kanban", 5000, 100, emptyCountsForTest({ leadsListFull: 2 })),
    ]);
    expect(v.status).toBe("confirmed");
  });

  test("G4 refutado com ratio baixo", () => {
    const v = validateHypothesisG4([
      sample("x", 5000, 100, emptyCountsForTest({ scheduledMessages: 5 })),
    ]);
    expect(v.status).toBe("rejected");
  });

  test("OUTAGE_STORM confirmado com muitos REST na recovery", () => {
    const v = validateHypothesisOutageStorm({
      outageDurationMs: 8000,
      preOutageReturnMs: 5000,
      postOutageReturnMs: 12000,
      requestsDuringRecovery: 200,
      deltaReturnMs: 7000,
    });
    expect(v.status).toBe("confirmed");
  });

  test("strictValidationFailures exige G2 confirmado", () => {
    const report = buildDiagnosisValidationReport(
      {
        generatedAt: "",
        baseURL: "",
        samples: [sample("view_list_to_kanban", 15000, 227, emptyCountsForTest({ totalRest: 28 }))],
        reportDiagnosis: [],
        thresholds: { returnToKanbanMsMax: 12000, callQueueByLeadMax: 80 },
      },
      null
    );
    expect(strictValidationFailures(report)).toHaveLength(0);
  });
});
