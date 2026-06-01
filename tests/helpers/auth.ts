import type { Page } from "@playwright/test";
import { loadE2eEnvSecure } from "./loadE2eEnv";

/**
 * Login E2E via formulário /login.
 * Credenciais: E2E_EMAIL / E2E_PASSWORD ou arquivo .env.e2e.local (gitignored).
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  loadE2eEnvSecure();
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) {
    return false;
  }

  await page.goto("/login");
  await page.locator("#email-signin").fill(email);
  await page.locator("#password-signin").fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();

  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", {
    timeout: 45_000,
  });
  await page.waitForLoadState("domcontentloaded");
  return true;
}

export function hasE2ECredentials(): boolean {
  return loadE2eEnvSecure();
}
