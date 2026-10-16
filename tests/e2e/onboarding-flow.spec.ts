import { test, expect, type Page } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";

/**
 * Fluxo completo: cadastro → onboarding (org + skip opcionais + funil) → dashboard.
 */

async function selectComboboxByLabel(page: Page, label: RegExp, optionText: string) {
  const field = page.locator("div.space-y-2").filter({ hasText: label }).first();
  const trigger = field.getByRole("combobox").first();
  await trigger.click();
  await page.getByRole("option", { name: optionText, exact: false }).first().click();
}

async function clickSkip(page: Page, human: HumanBehavior) {
  const skip = page.getByRole("button", { name: /pular e avançar/i });
  await expect(skip).toBeVisible({ timeout: 20_000 });
  await human.humanClick(skip);
}

async function signupAndOpenOnboarding(page: Page, human: HumanBehavior) {
  const stamp = Date.now();
  const email = `e2e.onboarding.${stamp}@mailinator.com`;
  const password = "Teste123!";

  await human.humanNavigate("/cadastro");
  await human.randomDelay(300, 600);
  await human.humanType(page.getByTestId("cadastro-fullname"), `E2E Onboarding ${stamp}`);
  await human.humanType(page.getByTestId("cadastro-email"), email);
  await human.humanType(page.getByTestId("cadastro-password"), password);
  await human.hesitate(200, 400);
  await human.humanClick(page.getByTestId("cadastro-submit"));

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /bem-vindo ao crm agilize/i })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("heading", { name: /dados da organização/i })).toBeVisible({
    timeout: 45_000,
  });

  return { email, password, stamp };
}

test.describe("Onboarding completo @human-behavior", () => {
  test("exibe stepper e primeiro passo (organização)", async ({ page }) => {
    test.setTimeout(90_000);
    const human = new HumanBehavior(page);
    await signupAndOpenOnboarding(page, human);

    await expect(page.getByText("Organização", { exact: true })).toBeVisible();
    await expect(page.getByText("Usuários", { exact: true })).toBeVisible();
    await expect(page.getByText("Funil", { exact: true })).toBeVisible();
    await expect(page.getByText("Produtos", { exact: true })).toBeVisible();
    await expect(page.getByText("WhatsApp", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /integração evolution/i })).toHaveCount(0);
  });

  test("completa onboarding até o dashboard", async ({ page }) => {
    test.setTimeout(180_000);
    const human = new HumanBehavior(page);
    const { stamp } = await signupAndOpenOnboarding(page, human);

    // --- Etapa 1: Organização ---
    await human.humanType(
      page.getByRole("textbox", { name: /nome da organização/i }),
      `Empresa E2E ${stamp}`
    );
    await selectComboboxByLabel(page, /perfil da empresa/i, "LTDA - Sociedade Limitada");
    await human.randomDelay(200, 400);
    await selectComboboxByLabel(page, /^estado/i, "São Paulo");
    await human.humanType(page.getByRole("textbox", { name: /cidade/i }), "São Paulo");
    await selectComboboxByLabel(page, /regime tributário/i, "Simples Nacional");
    await selectComboboxByLabel(page, /tipo de negócio/i, "Produtos e Serviços");

    await human.hesitate(300, 600);
    await human.humanClick(page.getByRole("button", { name: /^continuar$/i }));

    // Aguarda avanço OU toast de erro (falha real)
    await expect(page).toHaveURL(/step=users/, { timeout: 60_000 });
    await expect(page.getByText(/adicionar membros da equipe/i)).toBeVisible({ timeout: 30_000 });
    await clickSkip(page, human);

    // --- Etapa 3: Funil ---
    await expect(page).toHaveURL(/step=pipeline/, { timeout: 60_000 });
    await expect(page.getByText(/configure o funil/i)).toBeVisible({ timeout: 30_000 });

    const continuePipeline = page.getByRole("button", { name: /^continuar$/i }).last();
    if (await continuePipeline.isDisabled()) {
      const useDefaults = page.getByRole("button", { name: /usar etapas sugeridas/i });
      if (await useDefaults.isVisible().catch(() => false)) {
        await human.humanClick(useDefaults);
      }
    }
    await expect(continuePipeline).toBeEnabled({ timeout: 20_000 });
    await human.hesitate(200, 400);
    await human.humanClick(continuePipeline);

    // --- Etapa 4: Produtos ---
    await expect(page).toHaveURL(/step=products/, { timeout: 60_000 });
    await expect(page.getByText(/cadastrar produtos/i)).toBeVisible({ timeout: 30_000 });
    await clickSkip(page, human);

    // --- Etapa 5: WhatsApp ---
    await expect(page).toHaveURL(/step=evolution/, { timeout: 60_000 });
    await expect(
      page.getByText(/integração com whatsapp|integração whatsapp/i).first()
    ).toBeVisible({ timeout: 30_000 });
    await human.hesitate(300, 600);
    await clickSkip(page, human);

    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 90_000 });
  });
});
