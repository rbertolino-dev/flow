import { test, expect } from "@playwright/test";
import { generateInstanceNames, parseInstanceNames } from "../../src/lib/parseInstanceNames";

test.describe("@unit parse e geração de nomes de instâncias em lote", () => {
  test("separa por linha, vírgula e remove duplicados", () => {
    const names = parseInstanceNames("Chip 1\nChip 2, Chip 2; chip 3\n\nChip 1");
    expect(names).toEqual(["Chip 1", "Chip 2", "chip 3"]);
  });

  test("respeita o limite máximo", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Inst ${i + 1}`).join("\n");
    expect(parseInstanceNames(text, 50)).toHaveLength(50);
  });

  test("gera sequência com prefixo", () => {
    expect(generateInstanceNames("Chip ", 3, 4)).toEqual(["Chip 3", "Chip 4", "Chip 5", "Chip 6"]);
    expect(generateInstanceNames("Chip-", 1, 2)).toEqual(["Chip-1", "Chip-2"]);
  });
});
