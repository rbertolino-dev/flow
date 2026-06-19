import { test, expect } from "@playwright/test";
import {
  ROTATE_FIRST_SEND_STAGGER_SECONDS,
  ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS,
  computeRotateSchedule,
  firstSendPerInstance,
} from "../../src/lib/broadcastRotateSchedule";

const FIXED_DELAY_SEC = 1200;
const now = new Date("2026-06-18T13:00:00.000Z");

function buildRoundRobinQueue(chipCount: number, rounds: number) {
  const chips = Array.from({ length: chipCount }, (_, i) => `chip-${i + 1}`);
  const items: { id: string; instance_id: string }[] = [];
  let n = 0;
  for (let r = 0; r < rounds; r++) {
    for (const chip of chips) {
      items.push({ id: `msg-${n++}`, instance_id: chip });
    }
  }
  return { chips, items };
}

test.describe("@unit @human-behavior broadcast rotate stagger (simulação segura)", () => {
  test("1ª onda: chips não disparam todos no mesmo segundo (IClass 30 chips, rampa 25s)", () => {
    const { chips, items } = buildRoundRobinQueue(30, 1);
    const scheduled = computeRotateSchedule({
      queueItems: items,
      instanceIds: chips,
      minDelaySeconds: 1200,
      maxDelaySeconds: 1600,
      now,
      randomDelaySec: () => FIXED_DELAY_SEC,
    });

    const firstByChip = firstSendPerInstance(scheduled, items);
    expect(firstByChip.size).toBe(30);

    const times = chips.map((c) => firstByChip.get(c)!.getTime());
    const uniqueTimes = new Set(times);
    expect(uniqueTimes.size).toBe(30);

    for (let i = 0; i < chips.length; i++) {
      const expected = now.getTime() + i * ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS * 1000;
      expect(firstByChip.get(chips[i])!.getTime()).toBe(expected);
    }

    const spreadSec = (Math.max(...times) - Math.min(...times)) / 1000;
    expect(spreadSec).toBe((30 - 1) * ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS);
  });

  test("2º envio no mesmo chip respeita min delay após o 1º", () => {
    const { chips, items } = buildRoundRobinQueue(3, 2);
    const scheduled = computeRotateSchedule({
      queueItems: items,
      instanceIds: chips,
      minDelaySeconds: 1200,
      maxDelaySeconds: 1600,
      now,
      randomDelaySec: () => FIXED_DELAY_SEC,
    });

    const byChip = new Map<string, Date[]>();
    for (const row of scheduled) {
      const chip = items.find((i) => i.id === row.id)!.instance_id;
      if (!byChip.has(chip)) byChip.set(chip, []);
      byChip.get(chip)!.push(row.scheduled_for);
    }

    for (const [, times] of byChip) {
      times.sort((a, b) => a.getTime() - b.getTime());
      const gapSec = (times[1].getTime() - times[0].getTime()) / 1000;
      expect(gapSec).toBeGreaterThanOrEqual(FIXED_DELAY_SEC);
    }
  });

  test("ordem do pool instance_ids define o escalonamento (pool pequeno, 5s)", () => {
    const pool = ["c-a", "c-b", "c-c"];
    const items = pool.map((id, i) => ({ id: `m${i}`, instance_id: id }));
    const scheduled = computeRotateSchedule({
      queueItems: items,
      instanceIds: pool,
      minDelaySeconds: 60,
      maxDelaySeconds: 60,
      now,
      randomDelaySec: () => 60,
    });

    const first = firstSendPerInstance(scheduled, items);
    expect(first.get("c-a")!.getTime()).toBe(now.getTime());
    expect(first.get("c-b")!.getTime()).toBe(now.getTime() + ROTATE_FIRST_SEND_STAGGER_SECONDS * 1000);
    expect(first.get("c-c")!.getTime()).toBe(now.getTime() + 2 * ROTATE_FIRST_SEND_STAGGER_SECONDS * 1000);
  });

  test("simulação IClass: nenhum par de 1º envios com gap < 25s", () => {
    const { chips, items } = buildRoundRobinQueue(30, 1);
    const first = firstSendPerInstance(
      computeRotateSchedule({
        queueItems: items,
        instanceIds: chips,
        minDelaySeconds: 1200,
        maxDelaySeconds: 1600,
        now,
        randomDelaySec: () => 1400,
      }),
      items,
    );

    const sorted = [...first.entries()].sort(
      (a, b) => a[1].getTime() - b[1].getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i][1].getTime() - sorted[i - 1][1].getTime()) / 1000;
      expect(gap).toBeGreaterThanOrEqual(ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS);
    }
  });
});
