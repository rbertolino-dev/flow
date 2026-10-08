import { test, expect } from "@playwright/test";
import { TEST_PHONE_E164, TEST_PHONE_LOCAL, normalizeEvolutionSendPhone } from "../helpers/whatsappPhoneRules";
import {
  consolidateOpenConversationsForPhone,
  countLidGhosts,
  getChatwootFromEvolutionMatriz,
  openConversationsForPhone,
} from "../helpers/chatwootTestClient";

/**
 * Integração Chatwoot (conta Eletroneves) — 1 conversa aberta por número.
 * Roda contra API real; não envia WhatsApp por padrão.
 *
 * Envio vivo (opcional):
 *   LIVE_WHATSAPP_TEST=1 npx playwright test tests/e2e/chatwoot-one-conversation.integration.spec.ts --project=chromium-unit
 */
const INBOX_SAO_CAETANO = Number(process.env.CHATWOOT_INBOX_ID || 155);

test.describe("@integration Chatwoot uma conversa por número (Flow + dashboard)", () => {
  test("contato 21966224051 existe e tem no máximo 1 conversa aberta na caixa matriz", async () => {
    const phone = normalizeEvolutionSendPhone(TEST_PHONE_LOCAL);
    expect(phone).toBe(TEST_PHONE_E164);

    // Cura duplicatas (mesma regra do pós-envio no Flow) e valida o invariante
    const healed = await consolidateOpenConversationsForPhone(phone, INBOX_SAO_CAETANO);
    if (healed.resolved.length) {
      console.log("Conversas duplicadas resolvidas:", healed);
    }

    const { contact, open, all } = await openConversationsForPhone(phone, INBOX_SAO_CAETANO);
    expect(contact, "Contato Rubens/telefone deve existir no Chatwoot").toBeTruthy();
    expect(String(contact?.phone_number || contact?.identifier || "")).toMatch(/966224051/);

    console.log(
      JSON.stringify(
        {
          contactId: contact?.id,
          kept: healed.kept,
          openIds: open.map((c) => c.id),
          all: all.map((c) => ({ id: c.id, status: c.status, inbox: c.inbox_id })),
        },
        null,
        2,
      ),
    );

    expect(
      open.length,
      `Esperado ≤1 conversa aberta na inbox ${INBOX_SAO_CAETANO}; abertas: ${open.map((c) => c.id).join(", ")}`,
    ).toBeLessThanOrEqual(1);
  });

  test("não deve haver contato @lid fantasma ligado ao final do telefone", async () => {
    const ghosts = await countLidGhosts(TEST_PHONE_E164);
    expect(ghosts, "Contatos @lid fantasma para este número").toBe(0);
  });

  test("credenciais Evolution↔Chatwoot da matriz estão acessíveis (dashboard)", async () => {
    const cw = await getChatwootFromEvolutionMatriz();
    expect(cw.token.length).toBeGreaterThan(10);
    expect(cw.accountId).toBeGreaterThan(0);
    expect(cw.instanceName.toLowerCase()).toMatch(/eletroneves|matris|matriz|sao caetano/i);
  });

  test("LIVE: envia texto via Evolution só com dígitos e mantém ≤1 conversa aberta", async () => {
    test.skip(
      process.env.LIVE_WHATSAPP_TEST !== "1",
      "Envio vivo desligado. Use LIVE_WHATSAPP_TEST=1 para disparar mensagem de teste.",
    );
    test.setTimeout(90_000);
    const cw = await getChatwootFromEvolutionMatriz();
    const phone = normalizeEvolutionSendPhone(TEST_PHONE_LOCAL);
    const before = await openConversationsForPhone(phone, INBOX_SAO_CAETANO);

    const sendUrl = `${cw.apiUrl}/message/sendText/${encodeURIComponent(cw.instanceName)}`;
    const payload = {
      number: phone, // só dígitos — regra Flow + dashboard
      text: `[AUTOTEST] Agilize Flow ${new Date().toISOString()} — não responder`,
    };
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cw.apiKey,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    expect(res.ok, `Evolution send falhou: ${res.status} ${body.slice(0, 200)}`).toBeTruthy();

    await new Promise((r) => setTimeout(r, 5000));

    const after = await openConversationsForPhone(phone, INBOX_SAO_CAETANO);
    expect(after.open.length).toBeLessThanOrEqual(1);

    if (before.open.length === 1 && after.open.length === 1) {
      expect(after.open[0].id).toBe(before.open[0].id);
    }
  });
});
