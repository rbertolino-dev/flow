import { test, expect } from "@playwright/test";
import {
  decideBroadcastSendNumber,
  isNinthDigitCanonical,
  parseWhatsappNumbersBody,
} from "../../supabase/functions/_shared/broadcast-send-number.ts";

test.describe("@unit jid canônico do disparador 2", () => {
  test("troca só quando o JID é o mesmo celular sem o nono dígito", () => {
    const decision = decideBroadcastSendNumber("5541998495264", {
      ok: true,
      exists: true,
      jid: "554198495264@s.whatsapp.net",
    });
    expect(decision.rewritten).toBe(true);
    expect(decision.reason).toBe("canonical_jid");
    expect(decision.number).toBe("554198495264@s.whatsapp.net");
    expect(isNinthDigitCanonical("5541998495264", "554198495264")).toBe(true);
  });

  test("mantém DDD 11 quando o JID já inclui o 9", () => {
    const decision = decideBroadcastSendNumber("5511982726364", {
      ok: true,
      exists: true,
      jid: "5511982726364@s.whatsapp.net",
    });
    expect(decision.rewritten).toBe(false);
    expect(decision.reason).toBe("unchanged");
    expect(decision.number).toBe("5511982726364@s.whatsapp.net");
  });

  test("consulta falha, exists false, @lid ou JID de outro número mantêm o telefone da fila", () => {
    const original = "5541998495264@s.whatsapp.net";
    expect(decideBroadcastSendNumber("5541998495264", { ok: false }).number).toBe(original);
    expect(
      decideBroadcastSendNumber("5541998495264", { ok: true, exists: false, jid: null }).reason,
    ).toBe("exists_false");
    expect(
      decideBroadcastSendNumber("5541998495264", {
        ok: true,
        exists: true,
        jid: "12345@lid",
      }).reason,
    ).toBe("non_phone_jid");
    expect(
      decideBroadcastSendNumber("5541998495264", {
        ok: true,
        exists: true,
        jid: "5511999999999@s.whatsapp.net",
      }).reason,
    ).toBe("not_ninth_digit");
  });

  test("lê o corpo real do whatsappNumbers", () => {
    const body = [
      { jid: "554198495264@s.whatsapp.net", exists: true, number: "5541998495264" },
    ];
    const lookup = parseWhatsappNumbersBody(body, "5541998495264");
    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.exists).toBe(true);
    expect(decideBroadcastSendNumber("5541998495264", lookup).number).toBe(
      "554198495264@s.whatsapp.net",
    );
  });
});
