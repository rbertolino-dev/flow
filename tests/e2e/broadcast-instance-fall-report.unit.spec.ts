import { test, expect } from "@playwright/test";
import {
  aggregateInstanceFallReportFromLogs,
  isDisconnectFailureMessage,
} from "../../src/lib/broadcastCampaignInstanceFallReport";

test.describe("broadcastCampaignInstanceFallReport @unit", () => {
  test("detecta desconexão em PT e EN", () => {
    expect(isDisconnectFailureMessage('Instância "X" desconectada na Evolution', null)).toBe(true);
    expect(isDisconnectFailureMessage("Connection Closed", "OTHER")).toBe(true);
    expect(isDisconnectFailureMessage("rate limit", "HTTP_429")).toBe(false);
    expect(isDisconnectFailureMessage(null, "INSTANCE_UNAVAILABLE")).toBe(true);
  });

  test("conta enviados até a 1ª queda por instância", () => {
    const rows = aggregateInstanceFallReportFromLogs([
      {
        instance_id: "a",
        status: "sent",
        sent_at: "2026-08-04T10:00:00.000Z",
        instance: { id: "a", instance_name: "Chip A", is_connected: false },
      },
      {
        instance_id: "a",
        status: "sent",
        sent_at: "2026-08-04T10:05:00.000Z",
        instance: { id: "a", instance_name: "Chip A" },
      },
      {
        instance_id: "a",
        status: "failed",
        failed_at: "2026-08-04T10:06:00.000Z",
        error_message: 'Instância "Chip A" desconectada na Evolution',
        instance: { id: "a", instance_name: "Chip A" },
      },
      {
        instance_id: "a",
        status: "sent",
        sent_at: "2026-08-04T10:10:00.000Z",
        instance: { id: "a", instance_name: "Chip A" },
      },
      {
        instance_id: "b",
        status: "sent",
        sent_at: "2026-08-04T10:01:00.000Z",
        instance: { id: "b", instance_name: "Chip B", is_connected: true },
      },
    ]);

    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.instance_id === "a")!;
    const b = rows.find((r) => r.instance_id === "b")!;
    expect(a.fell).toBe(true);
    expect(a.sent_count).toBe(3);
    expect(a.sent_before_disconnect).toBe(2);
    expect(a.disconnect_fail_count).toBe(1);
    expect(b.fell).toBe(false);
    expect(b.sent_before_disconnect).toBe(1);
  });
});
