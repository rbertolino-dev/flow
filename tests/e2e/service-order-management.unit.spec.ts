import { test, expect } from "@playwright/test";
import {
  aggregateCollaboratorProductivity,
  aggregateStageTimes,
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

  test("tempo por etapa e produtividade", () => {
    const t0 = new Date("2026-10-14T10:00:00.000Z").getTime();
    const orders = [
      {
        id: "o1",
        created_at: new Date(t0).toISOString(),
        closed_at: new Date(t0 + 3 * 3_600_000).toISOString(),
        is_closed: true,
        status_id: "s2",
        status: { id: "s2", name: "Feito", color: "#0f0" },
        total: 100,
        collaborator_name: "João",
        starts_at: new Date(t0).toISOString(),
      },
    ];
    const logs = [
      {
        service_order_id: "o1",
        created_at: new Date(t0).toISOString(),
        metadata: { to_status_id: "s1", to_name: "Aberto" },
      },
      {
        service_order_id: "o1",
        created_at: new Date(t0 + 2 * 3_600_000).toISOString(),
        metadata: { to_status_id: "s2", to_name: "Feito" },
      },
    ];
    const stages = aggregateStageTimes(orders, logs, t0 + 3 * 3_600_000);
    expect(stages.find((s) => s.statusId === "s1")?.avgMs).toBe(2 * 3_600_000);
    expect(formatDurationMs(2 * 3_600_000)).toContain("h");

    const prod = aggregateCollaboratorProductivity(orders, t0 + 4 * 3_600_000);
    expect(prod[0]?.name).toBe("João");
    expect(prod[0]?.closedCount).toBe(1);
    expect(prod[0]?.avgCycleMs).toBe(3 * 3_600_000);
  });
});
