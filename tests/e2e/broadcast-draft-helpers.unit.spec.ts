import { expect, test } from "@playwright/test";

import {
  buildEvolutionValidationResultFromQueue,
  buildPhoneSetFromContacts,
  buildWahaValidationFromQueue,
  canEditDraft,
  extractMessageVariationsFromQueue,
  inferSendingMethodFromQueue,
  loadDraftContactsFromQueue,
  phonesChanged,
} from "../../src/lib/broadcastDraftHelpers";
import {
  buildEvolutionQueueRows,
  countEvolutionQueueTotal,
} from "../../src/lib/broadcastQueueEvolution";
import { buildWahaQueueRows, countWahaQueueTotal } from "../../src/lib/broadcastQueueWaha";

test.describe("@unit helpers de pré-campanha rascunho", () => {
  test("loadDraftContactsFromQueue deduplica por telefone e monta texto", () => {
    const { contacts, pastedText } = loadDraftContactsFromQueue([
      { phone: "5511999999999", name: "João", instance_id: "a" },
      { phone: "5511999999999", name: "João", instance_id: "b" },
      { phone: "5511888888888", name: "Maria", instance_id: "a" },
    ]);

    expect(contacts).toHaveLength(2);
    expect(pastedText).toContain("5511999999999");
    expect(pastedText).toContain("5511888888888");
  });

  test("inferSendingMethodFromQueue detecta rotate e separate", () => {
    const rotateRows = [
      { phone: "5511111111111", instance_id: "i1" },
      { phone: "5511222222222", instance_id: "i2" },
    ];
    expect(inferSendingMethodFromQueue(rotateRows).method).toBe("rotate");

    const separateRows = [
      { phone: "5511111111111", instance_id: "i1" },
      { phone: "5511111111111", instance_id: "i2" },
      { phone: "5511222222222", instance_id: "i1" },
      { phone: "5511222222222", instance_id: "i2" },
    ];
    expect(inferSendingMethodFromQueue(separateRows).method).toBe("separate");
  });

  test("extractMessageVariationsFromQueue retorna mensagens únicas", () => {
    const variations = extractMessageVariationsFromQueue(
      [
        { personalized_message: "Olá {nome}" },
        { personalized_message: "Oi {nome}" },
        { personalized_message: "Olá {nome}" },
      ],
      "Olá {nome}",
    );
    expect(variations).toEqual(["Olá {nome}", "Oi {nome}"]);
  });

  test("canEditDraft bloqueia campanha não-rascunho ou fila não-pending", () => {
    expect(canEditDraft({ status: "draft" }, ["pending", "pending"]).ok).toBe(true);
    expect(canEditDraft({ status: "running" }, ["pending"]).ok).toBe(false);
    expect(canEditDraft({ status: "draft" }, ["pending", "sent"]).ok).toBe(false);
  });

  test("phonesChanged compara conjuntos de telefones", () => {
    const original = buildPhoneSetFromContacts([
      { phone: "5511999999999" },
      { phone: "5511888888888" },
    ]);
    const smaller = buildPhoneSetFromContacts([{ phone: "+55 11 99999-9999" }]);
    expect(phonesChanged(original, smaller)).toBe(true);

    const equal = buildPhoneSetFromContacts([
      { phone: "5511999999999" },
      { phone: "5511888888888" },
    ]);
    expect(phonesChanged(original, equal)).toBe(false);
  });

  test("buildEvolutionValidationResultFromQueue", () => {
    expect(buildEvolutionValidationResultFromQueue(5).whatsappValid).toBe(5);
  });

  test("buildWahaValidationFromQueue", () => {
    const validation = buildWahaValidationFromQueue([
      { phone: "5511999999999", chat_id: "5511999999999@c.us" },
    ]);
    expect(validation.valid).toBe(1);
    expect(validation.results[0].exists).toBe(true);
  });

  test("buildEvolutionQueueRows rotate distribui instâncias", () => {
    const { rows, uniqueContacts } = buildEvolutionQueueRows({
      campaignId: "camp-1",
      organizationId: "org-1",
      contacts: [
        { phone: "5511111111111" },
        { phone: "5511222222222" },
      ],
      form: {
        sendingMethod: "rotate",
        instanceId: "",
        instanceIds: ["i1", "i2"],
        customMessage: "Olá",
        messageVariations: [],
      },
    });

    expect(uniqueContacts).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(rows[0].instance_id).toBe("i1");
    expect(rows[1].instance_id).toBe("i2");
  });

  test("countEvolutionQueueTotal separate multiplica contatos por instâncias", () => {
    expect(
      countEvolutionQueueTotal(10, {
        sendingMethod: "separate",
        instanceIds: ["i1", "i2"],
      }),
    ).toBe(20);
  });

  test("buildWahaQueueRows separate cria fila por sessão", () => {
    const rows = buildWahaQueueRows({
      campaignId: "camp-1",
      organizationId: "org-1",
      contacts: [{ phone: "5511111111111", name: "A", empresa: "" }],
      form: {
        method: "separate",
        sessionIds: ["s1", "s2"],
        message: "Oi {nome}",
        messageVariations: [],
      },
      chatIdByPhone: new Map([["5511111111111", "5511111111111@c.us"]]),
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.session_id).sort()).toEqual(["s1", "s2"]);
  });

  test("countWahaQueueTotal", () => {
    expect(
      countWahaQueueTotal(5, { method: "separate", sessionIds: ["s1", "s2", "s3"] }),
    ).toBe(15);
  });
});
