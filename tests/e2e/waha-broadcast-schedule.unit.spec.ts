import { expect, test } from "@playwright/test";

import {
  nextMinuteStart,
  scheduleWahaQueue,
} from "../../src/lib/wahaBroadcastSchedule";

test.describe("@unit agendamento WAHA no próximo minuto", () => {
  test("arredonda para o próximo minuto cheio", () => {
    const from = new Date("2026-08-26T13:22:40.500Z");
    const start = nextMinuteStart(from);
    expect(start.toISOString()).toBe("2026-08-26T13:23:00.000Z");
  });

  test("no minuto exato avança um minuto", () => {
    const from = new Date("2026-08-26T13:22:00.000Z");
    expect(nextMinuteStart(from).toISOString()).toBe("2026-08-26T13:23:00.000Z");
  });

  test("primeiro envio de cada sessão é no início; intervalo só entre os seguintes", () => {
    const startAt = new Date("2026-08-26T13:23:00.000Z");
    const scheduled = scheduleWahaQueue({
      items: [
        { id: "a1", session_id: "s1" },
        { id: "a2", session_id: "s1" },
        { id: "b1", session_id: "s2" },
        { id: "b2", session_id: "s2" },
      ],
      minDelaySeconds: 3000,
      maxDelaySeconds: 4000,
      startAt,
      randomDelaySec: () => 3000,
    });

    const byId = Object.fromEntries(
      scheduled.map((row) => [row.id, row.scheduled_for.toISOString()]),
    );
    expect(byId.a1).toBe("2026-08-26T13:23:00.000Z");
    expect(byId.b1).toBe("2026-08-26T13:23:00.000Z");
    expect(byId.a2).toBe("2026-08-26T14:13:00.000Z");
    expect(byId.b2).toBe("2026-08-26T14:13:00.000Z");
  });

  test("não aplica o delay no único contato da sessão", () => {
    const startAt = new Date("2026-08-26T13:23:00.000Z");
    const [only] = scheduleWahaQueue({
      items: [{ id: "only", session_id: "s1" }],
      minDelaySeconds: 3000,
      maxDelaySeconds: 4000,
      startAt,
      randomDelaySec: () => 4000,
    });
    expect(only.scheduled_for.toISOString()).toBe("2026-08-26T13:23:00.000Z");
  });
});
