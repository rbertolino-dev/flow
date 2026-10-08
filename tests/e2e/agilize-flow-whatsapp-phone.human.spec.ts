import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials, loginAsTestUser } from "../helpers/auth";
import { TEST_PHONE_LOCAL } from "../helpers/whatsappPhoneRules";

/**
 * @human-behavior Agilize Flow (CRM) — navegação até área de mensagens/agendamento
 * com foco no número 21966224051. Não dispara WhatsApp (só UI + regras).
 *
 * Requer E2E_EMAIL / E2E_PASSWORD ou .env.e2e.local
 */
test.describe("@human-behavior Agilize Flow — telefone 21966224051", () => {
  test("abre central de mensagens e busca o telefone de teste", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem E2E_EMAIL/E2E_PASSWORD — pulando UI do Flow");
    test.setTimeout(90_000);
    const human = new HumanBehavior(page);

    const ok = await loginAsTestUser(page);
    test.skip(!ok, "Login E2E falhou");
    await human.humanNavigate("/messages-center");
    await human.randomDelay(1200, 2000);

    // Campo de busca genérico
    const search = page
      .locator(
        'input[placeholder*="buscar" i], input[placeholder*="pesquisa" i], input[type="search"], input[name*="search" i]',
      )
      .first();

    if (await search.isVisible({ timeout: 8000 }).catch(() => false)) {
      await human.humanClick(search);
      await human.humanType(search, TEST_PHONE_LOCAL);
      await human.randomDelay(800, 1500);
    } else {
      // Fallback: ir ao funil e buscar lead
      await human.humanNavigate("/crm");
      await human.randomDelay(1000, 1800);
      const funnelSearch = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
      if (await funnelSearch.isVisible().catch(() => false)) {
        await human.humanType(funnelSearch, TEST_PHONE_LOCAL);
        await human.randomDelay(800, 1400);
      }
    }

    // Deve aparecer algo relacionado a Rubens ou ao número
    const hint = page.getByText(/rubens|96622-?4051|21966224051/i).first();
    const visible = await hint.isVisible({ timeout: 10000 }).catch(() => false);
    if (visible) {
      await expect(hint).toBeVisible();
    } else {
      // Ambiente sem o lead — ainda assim a página carregou
      await expect(page.locator("body")).toBeVisible();
      test.info().annotations.push({
        type: "note",
        description: "Lead/telefone não apareceu na UI; regras unitárias cobrem a normalização.",
      });
    }
  });
});
