import { test, expect } from "@playwright/test";
import { applyLeadTagsPatch } from "../../src/utils/leadTagsSync";
import type { Lead } from "../../src/types/lead";

const tagA = { id: "tag-a", name: "Quente", color: "#ff0000" };
const tagB = { id: "tag-b", name: "Frio", color: "#0000ff" };

const baseLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Cliente Teste",
    phone: "5511999999999",
    status: "novo",
    source: "WhatsApp",
    assignedTo: "Não atribuído",
    lastContact: new Date(),
    createdAt: new Date(),
    activities: [],
    tags: [tagA],
  },
];

test.describe("@unit leadTagsSync", () => {
  test("applyLeadTagsPatch adiciona tag sem duplicar", () => {
    const next = applyLeadTagsPatch(baseLeads, {
      leadId: "lead-1",
      action: "add",
      tag: tagB,
    });
    expect(next[0].tags).toHaveLength(2);
    expect(next[0].tags?.map((t) => t.id)).toEqual(["tag-a", "tag-b"]);

    const again = applyLeadTagsPatch(next, {
      leadId: "lead-1",
      action: "add",
      tag: tagB,
    });
    expect(again[0].tags).toHaveLength(2);
  });

  test("applyLeadTagsPatch remove tag idempotentemente", () => {
    const next = applyLeadTagsPatch(baseLeads, {
      leadId: "lead-1",
      action: "remove",
      tag: tagA,
    });
    expect(next[0].tags).toHaveLength(0);

    const again = applyLeadTagsPatch(next, {
      leadId: "lead-1",
      action: "remove",
      tag: tagA,
    });
    expect(again[0].tags).toHaveLength(0);
    expect(again).toStrictEqual(next);
  });

  test("applyLeadTagsPatch ignora lead inexistente", () => {
    const next = applyLeadTagsPatch(baseLeads, {
      leadId: "outro-lead",
      action: "add",
      tag: tagB,
    });
    expect(next).toEqual(baseLeads);
  });

  test("applyLeadTagsPatch ignora detail inválido", () => {
    const next = applyLeadTagsPatch(baseLeads, {
      leadId: "",
      action: "add",
      tag: tagB,
    });
    expect(next).toBe(baseLeads);
  });
});
