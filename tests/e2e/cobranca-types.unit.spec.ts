import { test, expect } from "@playwright/test";
import {
  formatMoney,
  shortPaymentCode,
  monthRangeIso,
  STATUS_LABELS,
} from "../../src/components/asaas/cobrancaTypes";

test.describe("cobrancaTypes — helpers @unit", () => {
  test("formatMoney formata BRL", () => {
    const out = formatMoney(1234.5);
    expect(out).toMatch(/R\$/);
    expect(out.replace(/\s/g, " ")).toContain("1.234,50");
  });

  test("shortPaymentCode corta ids longos", () => {
    expect(shortPaymentCode(null)).toBe("—");
    expect(shortPaymentCode(undefined)).toBe("—");
    expect(shortPaymentCode("pay_abc")).toBe("pay_abc");
    expect(shortPaymentCode("pay_1234567890ABCDEF")).toBe("pay_12345678");
  });

  test("monthRangeIso cobre o mês corrente", () => {
    const base = new Date(2026, 9, 16); // out/2026
    const { from, to } = monthRangeIso(base);
    expect(from).toBe("2026-10-01");
    expect(to).toBe("2026-10-31");
  });

  test("STATUS_LABELS cobre status usados na UI", () => {
    expect(STATUS_LABELS.paid).toBe("Pago");
    expect(STATUS_LABELS.overdue).toBe("Vencido");
    expect(STATUS_LABELS.pending).toBe("Pendente");
  });
});
