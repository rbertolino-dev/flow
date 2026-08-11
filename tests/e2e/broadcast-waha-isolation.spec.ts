import { expect, test } from "@playwright/test";

import { loginAsTestUser, hasE2ECredentials } from "../helpers/auth";
import { HumanBehavior } from "../helpers/human-behavior";

test.describe("Disparador WAHA isolado @human-behavior", () => {
  test("alterna entre WAHA e Evolution sem misturar os painéis", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByRole("heading", { name: "Disparador WAHA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar campanha Evolution" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar campanha WAHA" })).toBeVisible();
    await expect(page.getByText("Sincronizar status com Evolution")).toHaveCount(0);

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: "Criar campanha Evolution" }));
    await expect(page).toHaveURL(/\/broadcast-2$/);
    await expect(page.getByText("Sincronizar status com Evolution")).toBeVisible();
  });

  test("valida WhatsApp e simula sem criar campanha", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByText("Templates WAHA")).toBeVisible();

    const phoneText = await page.getByText(/^55\d{10,13}\s·/).first().textContent();
    const phone = phoneText?.match(/55\d{10,13}/)?.[0];
    test.skip(!phone, "Nenhuma sessão WAHA com telefone disponível");

    await human.humanClick(page.getByRole("button", { name: "Nova campanha WAHA" }));
    await human.humanType("#waha-name", "Simulação E2E WAHA");
    await human.humanClick(page.locator('[role="checkbox"]').first());
    await human.humanType("#waha-message", "Olá, {nome}! Teste de simulação.");
    await human.humanType("#waha-contacts", `Contato teste;${phone}`);

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: "Checar e validar WhatsApp" }));
    await expect(page.getByText("Com WhatsApp")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    await human.humanClick(page.getByRole("button", { name: "Simular envio" }));
    await expect(page.getByRole("heading", { name: "Simulação do envio WAHA" })).toBeVisible();
    await expect(page.getByText("Esta simulação não envia mensagens nem grava a campanha.")).toBeVisible();
    await expect(page.getByText("Distribuição por sessão")).toBeVisible();
  });
});
