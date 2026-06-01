import { test, expect } from "@playwright/test";
import { maskEmail } from "../helpers/loadE2eEnv";

test.describe("@unit loadE2eEnv", () => {
  test("maskEmail não expõe e-mail completo", () => {
    expect(maskEmail("teste@empresa.com.br")).toBe("te***@empresa.com.br");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
});
