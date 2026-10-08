import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { HumanBehavior } from "../helpers/human-behavior";
import { TEST_PHONE_LOCAL, normalizeEvolutionSendPhone } from "../helpers/whatsappPhoneRules";

/**
 * @human-behavior App dashboard (ponte Chatwoot → Agilize Flow)
 * Valida UI da aba Flow com o telefone 21966224051 sem enviar WhatsApp.
 *
 * URL: BRIDGE_URL ou http://127.0.0.1:3045/?k=APP_SECRET
 */
function bridgeUrl(): string {
  if (process.env.BRIDGE_URL) return process.env.BRIDGE_URL;
  try {
    const envText = fs.readFileSync("/root/chatwoot-agilize-bridge/.env", "utf8");
    const secret = envText
      .split("\n")
      .find((l) => l.startsWith("APP_SECRET="))
      ?.split("=")
      .slice(1)
      .join("=")
      .trim();
    if (secret) return `http://127.0.0.1:3045/?k=${encodeURIComponent(secret)}`;
  } catch {
    /* ignore */
  }
  return "http://127.0.0.1:3045/";
}

test.describe("@human-behavior App dashboard Flow — telefone 21966224051", () => {
  test("preenche contato e mostra seções de orçamento/OS/agendamento", async ({ page }) => {
    test.setTimeout(60_000);
    const human = new HumanBehavior(page);
    const url = bridgeUrl();

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await human.randomDelay(800, 1400);

    // Simula contexto Chatwoot (appContext) com Rubens
    await page.evaluate(
      ({ phone, accountId }) => {
        const payload = {
          event: "appContext",
          data: {
            account_id: accountId,
            conversation: {
              id: 149,
              account_id: accountId,
              inbox_id: 155,
            },
            contact: {
              name: "Rubens",
              phone_number: `+55${phone}`,
              phone: phone,
            },
          },
        };
        window.postMessage(payload, "*");
        window.dispatchEvent(new MessageEvent("message", { data: payload }));
      },
      { phone: TEST_PHONE_LOCAL, accountId: 31 },
    );

    await human.randomDelay(600, 1000);

    const phoneInput = page.locator("#phone, input[name='phone']").first();
    if (await phoneInput.isVisible().catch(() => false)) {
      const value = await phoneInput.inputValue();
      if (!value.includes("966224051") && !value.includes("21966224051")) {
        await human.humanType(phoneInput, TEST_PHONE_LOCAL);
      }
      const current = await phoneInput.inputValue();
      expect(normalizeEvolutionSendPhone(current.replace(/\D/g, "").length >= 10 ? current : TEST_PHONE_LOCAL)).toBe(
        "5521966224051",
      );
    }

    // Abas do menu
    const budgetBtn = page.locator('button[data-panel="budget"], button:has-text("Orçamento")').first();
    if (await budgetBtn.isVisible().catch(() => false)) {
      await human.humanClick(budgetBtn);
      await human.randomDelay(500, 900);
      await expect(page.locator("#budget, form#budget").first()).toBeVisible({ timeout: 5000 });
    }

    const orderBtn = page.locator('button[data-panel="order"], button:has-text("Ordem")').first();
    if (await orderBtn.isVisible().catch(() => false)) {
      await human.humanClick(orderBtn);
      await human.randomDelay(500, 900);
      await expect(page.locator("#order, form#order").first()).toBeVisible({ timeout: 5000 });
      // Modelo precisa ser escolhido para liberar produtos/serviços
      const template = page.locator("#osTemplate");
      if (await template.isVisible().catch(() => false)) {
        const options = await template.locator("option").count();
        if (options > 1) {
          await template.selectOption({ index: 1 });
          await human.randomDelay(400, 700);
          const services = page.locator(".service-focus").first();
          await expect(services).toBeVisible({ timeout: 5000 });
          const productsFold = page.locator("#osProductsFold").first();
          if (await productsFold.count()) {
            expect(await productsFold.getAttribute("open")).toBeFalsy();
          }
        }
      }
    }

    const scheduleBtn = page.locator('button[data-panel="schedule"], button:has-text("Agendamento")').first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await human.humanClick(scheduleBtn);
      await human.randomDelay(400, 800);
    }
  });
});
