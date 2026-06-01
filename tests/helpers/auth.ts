import type { Page } from "@playwright/test";

/**
 * Login E2E via formulário /login.
 * Requer variáveis de ambiente: E2E_EMAIL e E2E_PASSWORD
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
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
  return Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());
}
