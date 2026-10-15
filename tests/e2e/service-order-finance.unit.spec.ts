import { test, expect } from "@playwright/test";
import {
  billableOrderItems,
  financeStatusLabel,
  formatOsMoney,
  orderItemsCost,
  pickActiveFinanceEntry,
} from "../../src/lib/serviceOrderFinance";

test.describe("serviceOrderFinance @unit", () => {
  test("billable vs insumos e custo", () => {
    const items = [
      {
        id: "1",
        item_type: "service" as const,
        name: "Visita",
        quantity: 1,
        unit_price: 100,
        unit_cost: 20,
        total_price: 100,
        use_cost: false,
      },
      {
        id: "2",
        item_type: "product" as const,
        name: "Filtro",
        quantity: 2,
        unit_price: 0,
        unit_cost: 15,
        total_price: 0,
        use_cost: true,
      },
    ];
    expect(billableOrderItems(items)).toHaveLength(1);
    expect(orderItemsCost(items)).toBe(20 + 30);
    expect(formatOsMoney(100)).toContain("100");
  });

  test("status e pick de lançamento ativo", () => {
    expect(financeStatusLabel(null)).toBe("Não lançado");
    expect(financeStatusLabel("open")).toBe("Em aberto");
    expect(financeStatusLabel("paid")).toBe("Pago");
    const rows = [
      {
        id: "a",
        direction: "receber" as const,
        amount: 10,
        status: "cancelled" as const,
        account: "Caixa",
        description: null,
        source_type: "ordem_servico",
        source_id: "o1",
      },
      {
        id: "b",
        direction: "receber" as const,
        amount: 50,
        status: "open" as const,
        account: "Caixa",
        description: null,
        source_type: "ordem_servico",
        source_id: "o1",
      },
    ];
    expect(pickActiveFinanceEntry(rows, "ordem_servico", "o1")?.id).toBe("b");
  });
});
