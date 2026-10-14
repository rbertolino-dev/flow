import { test, expect } from "@playwright/test";
import {
  aggregateCollaboratorProductivity,
  aggregateStageTimes,
  attendanceCycleBoundsMs,
  formatDurationMs,
  hasServiceOrderTechnician,
  isServiceOrderOpenToday,
  isServiceOrderOverdue,
} from "../../src/lib/serviceOrderManagement";

test.describe("serviceOrderManagement @unit", () => {
  test("atraso e técnico", () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(isServiceOrderOverdue({ starts_at: past, is_closed: false })).toBe(true);
    expect(isServiceOrderOverdue({ starts_at: past, is_closed: true })).toBe(false);
    expect(isServiceOrderOverdue({ starts_at: future, is_closed: false })).toBe(false);
    expect(hasServiceOrderTechnician({ collaborator_name: "Ana" })).toBe(true);
    expect(hasServiceOrderTechnician({})).toBe(false);
  });

  test("abertas hoje", () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(10, 0, 0, 0);
    expect(isServiceOrderOpenToday({ starts_at: today.toISOString(), is_closed: false }, now)).toBe(
      true,
    );
  });

  test("ciclo ignora 1ª etapa e Finalizado", () => {
    const t0 = new Date("2026-10-14T10:00:00.000Z").getTime();
    const catalog = [
      { id: "s1", name: "Aguardando", sort_order: 10, is_final: false, color: "#aaa" },
      { id: "s2", name: "Em andamento", sort_order: 20, is_final: false, color: "#0af" },
      { id: "s3", name: "Finalizado", sort_order: 30, is_final: true, color: "#0f0" },
    ];
    const orders = [
      {
        id: "o1",
        created_at: new Date(t0).toISOString(),
        closed_at: new Date(t0 + 5 * 3_600_000).toISOString(),
        is_closed: true,
        status_id: "s3",
        status: { id: "s3", name: "Finalizado", color: "#0f0", is_final: true },
        total: 100,
        collaborator_name: "João",
        starts_at: new Date(t0).toISOString(),
      },
    ];
    const logs = [
      {
        service_order_id: "o1",
        created_at: new Date(t0).toISOString(),
        metadata: { to_status_id: "s1", to_name: "Aguardando" },
      },
      {
        service_order_id: "o1",
        created_at: new Date(t0 + 2 * 3_600_000).toISOString(),
        metadata: { to_status_id: "s2", to_name: "Em andamento" },
      },
      {
        service_order_id: "o1",
        created_at: new Date(t0 + 5 * 3_600_000).toISOString(),
        metadata: { to_status_id: "s3", to_name: "Finalizado" },
      },
    ];

    const stages = aggregateStageTimes(orders, logs, t0 + 6 * 3_600_000, catalog);
    expect(stages.find((s) => s.statusId === "s1")).toBeUndefined();
    expect(stages.find((s) => s.statusId === "s3")).toBeUndefined();
    expect(stages.find((s) => s.statusId === "s2")?.avgMs).toBe(3 * 3_600_000);
    expect(formatDurationMs(3 * 3_600_000)).toContain("h");

    const bounds = attendanceCycleBoundsMs(logs, catalog);
    expect(bounds?.startMs).toBe(t0 + 2 * 3_600_000);
    expect(bounds?.endMs).toBe(t0 + 5 * 3_600_000);

    const prod = aggregateCollaboratorProductivity(orders, t0 + 6 * 3_600_000, logs, catalog);
    expect(prod[0]?.name).toBe("João");
    expect(prod[0]?.avgCycleMs).toBe(3 * 3_600_000);
  });
});
