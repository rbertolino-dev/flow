import { expect, test } from "@playwright/test";

import {
  MAX_WAHA_DELAY_SEC,
  MIN_WAHA_DELAY_SEC,
  validateWahaSendInterval,
} from "../../src/lib/broadcastValidators";

test.describe("@unit intervalo de envio WAHA", () => {
  test("aceita intervalo lento 3000–4000 segundos", () => {
    const result = validateWahaSendInterval(3000, 4000);
    expect(result.valid).toBe(true);
  });

  test("aceita o antigo teto de 1 hora", () => {
    expect(validateWahaSendInterval(30, 3600).valid).toBe(true);
  });

  test("aceita o teto de 24 horas alinhado ao Evolution", () => {
    expect(validateWahaSendInterval(MIN_WAHA_DELAY_SEC, MAX_WAHA_DELAY_SEC).valid).toBe(
      true,
    );
  });

  test("rejeita máximo menor que o mínimo", () => {
    const result = validateWahaSendInterval(60, 30);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/máximo não pode ser menor/i);
  });

  test("rejeita abaixo do mínimo de 5 segundos", () => {
    const result = validateWahaSendInterval(4, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pelo menos 5/);
  });

  test("rejeita acima de 24 horas", () => {
    const result = validateWahaSendInterval(3000, MAX_WAHA_DELAY_SEC + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/24 horas/);
  });
});
