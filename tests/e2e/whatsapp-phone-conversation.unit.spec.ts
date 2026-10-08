import { test, expect } from "@playwright/test";
import {
  TEST_PHONE_E164,
  TEST_PHONE_LID,
  TEST_PHONE_LOCAL,
  evolutionSendNumberFromPhone,
  looksLikeWhatsappLid,
  normalizeEvolutionSendPhone,
} from "../helpers/whatsappPhoneRules";

/**
 * @unit Regras de telefone / anti-@lid usadas no Agilize Flow e no app dashboard.
 * Número de referência: 21966224051 → 5521966224051
 */
test.describe("@unit WhatsApp telefone e anti-conversa fantasma", () => {
  test("normaliza 21966224051 para 5521966224051 (só dígitos)", () => {
    expect(normalizeEvolutionSendPhone(TEST_PHONE_LOCAL)).toBe(TEST_PHONE_E164);
    expect(normalizeEvolutionSendPhone("(21) 96622-4051")).toBe(TEST_PHONE_E164);
    expect(normalizeEvolutionSendPhone("+55 21 96622-4051")).toBe(TEST_PHONE_E164);
    expect(normalizeEvolutionSendPhone(TEST_PHONE_E164)).toBe(TEST_PHONE_E164);
  });

  test("payload de envio nunca usa @s.whatsapp.net nem @lid", () => {
    const number = evolutionSendNumberFromPhone(TEST_PHONE_LOCAL);
    expect(number).toBe(TEST_PHONE_E164);
    expect(number.includes("@")).toBe(false);
    expect(/@lid/i.test(number)).toBe(false);
  });

  test("bloqueia ID interno @lid (fantasma +1244…)", () => {
    expect(looksLikeWhatsappLid(TEST_PHONE_LID)).toBe(true);
    expect(() => normalizeEvolutionSendPhone(TEST_PHONE_LID)).toThrow(/ID interno|@lid|inválido/i);
    expect(() => normalizeEvolutionSendPhone(`${TEST_PHONE_LID}@lid`)).toThrow(/@lid|ID interno/i);
    expect(() => normalizeEvolutionSendPhone(`+${TEST_PHONE_LID}`)).toThrow(/ID interno|inválido/i);
  });

  test("telefone real do Rubens não é tratado como LID", () => {
    expect(looksLikeWhatsappLid(TEST_PHONE_LOCAL)).toBe(false);
    expect(looksLikeWhatsappLid(TEST_PHONE_E164)).toBe(false);
  });
});
