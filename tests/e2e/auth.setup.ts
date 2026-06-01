import { mkdirSync } from "fs";
import path from "path";
import { test as setup, expect } from "@playwright/test";
import { loginAsTestUser } from "../helpers/auth";
import { E2E_AUTH_FILE } from "../helpers/e2eAuthPaths";
import { loadE2eEnvSecure, maskEmail } from "../helpers/loadE2eEnv";

setup("autenticar usuário E2E (uma vez por execução)", async ({ page }) => {
  if (!loadE2eEnvSecure()) {
    setup.skip(
      true,
      "Crie .env.e2e.local a partir de .env.e2e.example (chmod 600). Não commite credenciais."
    );
  }

  const loggedIn = await loginAsTestUser(page);
  expect(loggedIn, "Login E2E falhou — verifique .env.e2e.local").toBe(true);

  mkdirSync(path.dirname(E2E_AUTH_FILE), { recursive: true, mode: 0o700 });
  await page.context().storageState({ path: E2E_AUTH_FILE });

  const email = process.env.E2E_EMAIL?.trim() ?? "";
  console.log(`Sessão E2E salva em playwright/.auth/ (${maskEmail(email)})`);
});
