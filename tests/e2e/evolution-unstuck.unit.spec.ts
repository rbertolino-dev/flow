import { test, expect } from "@playwright/test";
import {
  buildChatwootSetBody,
  buildSettingsSetBody,
  buildWebhookSetBody,
  extractQrFromEvolutionResponse,
  isUuid,
  pickFetchInstance,
} from "../../supabase/functions/_shared/evolution-unstuck";

test.describe("@unit destravar instância Evolution", () => {
  test("aceita UUID e rejeita lixo", () => {
    expect(isUuid("ce86a17c-a10a-4979-af87-54a2b149638a")).toBe(true);
    expect(isUuid("Ana Clara")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  test("monta Chatwoot só com url+token e inbox original", () => {
    const body = buildChatwootSetBody(
      {
        enabled: true,
        accountId: "1",
        token: "abc",
        url: "https://centralize.ordemservico.com",
        nameInbox: "Ana Clara",
        organization: "IClass",
        importMessages: false,
      },
      "fallback",
    );
    expect(body).toMatchObject({
      enabled: true,
      accountId: "1",
      nameInbox: "Ana Clara",
      autoCreate: true,
      url: "https://centralize.ordemservico.com",
    });
    expect(buildChatwootSetBody({ enabled: true, url: "x" }, "n")).toBeNull();
    expect(buildChatwootSetBody(null, "n")).toBeNull();
  });

  test("restaura webhook aninhado da Evolution v2", () => {
    const body = buildWebhookSetBody({
      url: "https://example.com/hook",
      enabled: true,
      events: ["MESSAGES_UPSERT"],
    });
    expect(body).toEqual({
      webhook: {
        enabled: true,
        url: "https://example.com/hook",
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT"],
      },
    });
    expect(buildWebhookSetBody(null)).toBeNull();
  });

  test("settings usa booleanos seguros", () => {
    expect(buildSettingsSetBody({ rejectCall: true, groupsIgnore: false })).toMatchObject({
      rejectCall: true,
      groupsIgnore: false,
      alwaysOnline: false,
    });
  });

  test("extrai QR base64 e pairing code", () => {
    const b64 = "A".repeat(120) + "==";
    expect(extractQrFromEvolutionResponse({ base64: b64 }).qrCode).toBe(`data:image/png;base64,${b64}`);
    expect(extractQrFromEvolutionResponse({ code: "2@pairing" }).qrCodeData).toBe("2@pairing");
    expect(extractQrFromEvolutionResponse(null).qrCode).toBeNull();
  });

  test("localiza instância no fetchInstances pelo nome", () => {
    const rows = [
      { name: "Outra", token: "x" },
      { name: "Joana Ferreira", token: "secret", Chatwoot: { nameInbox: "Joana Ferreira" } },
    ];
    const found = pickFetchInstance(rows, "joana ferreira");
    expect(found?.name).toBe("Joana Ferreira");
    expect(pickFetchInstance(rows, "inexistente")).toBeNull();
  });
});
