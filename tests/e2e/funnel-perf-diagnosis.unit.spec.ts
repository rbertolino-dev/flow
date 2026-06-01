import { test, expect } from "@playwright/test";
import {
  computeRatios,
  diagnoseFunnelSample,
  aggregateReportDiagnosis,
  emptyCountsForTest,
} from "../helpers/funnelPerf";

test.describe("@unit funnelPerf diagnosis", () => {
  test("detecta G1 quando callQueuePerCard alto", () => {
    const req = emptyCountsForTest({ callQueueByLead: 50 });
    const { diagnosis, primaryBottleneck } = diagnoseFunnelSample({
      scenario: "test",
      returnToKanbanMs: 2000,
      firstCardVisibleMs: 800,
      visibleKanbanCards: 50,
      requestsDuringReturn: req,
      ratios: computeRatios(req, 50),
    });
    expect(primaryBottleneck).toBe("G1");
    expect(diagnosis.some((d) => d.id === "G1" && d.severity === "critical")).toBe(true);
  });

  test("detecta G2 quando lento sem N+1", () => {
    const req = emptyCountsForTest();
    const { diagnosis } = diagnoseFunnelSample({
      scenario: "test",
      returnToKanbanMs: 5000,
      firstCardVisibleMs: 400,
      visibleKanbanCards: 40,
      requestsDuringReturn: req,
      ratios: computeRatios(req, 40),
    });
    expect(diagnosis.some((d) => d.id === "G2")).toBe(true);
  });

  test("aggregateReportDiagnosis agrupa cenários", () => {
    const req = emptyCountsForTest({ callQueueByLead: 10 });
    const sample = {
      scenario: "a",
      returnToKanbanMs: 1000,
      firstCardVisibleMs: 500,
      visibleKanbanCards: 10,
      requestsDuringReturn: req,
      ratios: computeRatios(req, 10),
      diagnosis: [{ id: "G1", severity: "critical" as const, message: "x" }],
      primaryBottleneck: "G1",
    };
    const report = aggregateReportDiagnosis([sample, { ...sample, scenario: "b" }]);
    expect(report.some((r) => r.id === "G1")).toBe(true);
  });
});
