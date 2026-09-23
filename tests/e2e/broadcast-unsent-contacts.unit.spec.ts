import { test, expect } from "@playwright/test";
import { formatUnsentContactsText } from "../../src/lib/broadcastUnsentContacts";

test.describe("@unit números não disparados da campanha cancelada", () => {
  test("copia só dígitos válidos, sem duplicar, com nome quando existe", () => {
    const text = formatUnsentContactsText([
      { phone: "+55 (21) 99999-0001", name: "Ana" },
      { phone: "5521999990001", name: "Outra" },
      { phone: "21988880002", name: null },
      { phone: "123", name: "Curto" },
      { phone: "", name: "Vazio" },
    ]);
    expect(text).toBe("5521999990001,Ana\n21988880002");
  });

  test("lista vazia não gera texto", () => {
    expect(formatUnsentContactsText([])).toBe("");
  });
});