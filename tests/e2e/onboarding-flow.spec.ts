import { test, expect, type Page } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";

async function selectComboboxByLabel(page: Page, label: RegExp, optionText: string) {
  const field = page.locator("div.space-y-2").filter({ hasText: label }).first();
  await field.getByRole("combobox").first().click();
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
  await human.humanNavigate("/cadastro");
  await human.humanType(page.getByTestId("cadastro-fullname"), `E2E Onboarding ${stamp}`);
  await human.humanType(page.getByTestId("cadastro-email"), email);
  await human.humanType(page.getByTestId("cadastro-password"), "Teste123!");
  await human.humanClick(page.getByTestId("cadastro-submit"));
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /dados da organização/i })).toBeVisible({
    timeout: 45_000,
  });
  return { stamp };
}

test.describe("Onboarding completo @human-behavior", () => {
  test("cadastro sinaliza obrigatórios e onboarding sem WhatsApp", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/cadastro");
    await expect(page.getByText(/campos com .* são obrigatórios/i)).toBeVisible();

    const human = new HumanBehavior(page);
    await signupAndOpenOnboarding(page, human);
    await expect(page.getByText("Organização", { exact: true })).toBeVisible();
    await expect(page.getByText("Produtos", { exact: true })).toBeVisible();
    await expect(page.getByText("WhatsApp", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/selecione o provider|evolution/i)).toHaveCount(0);
  });

  test("completa onboarding até o dashboard sem etapa Evolution", async ({ page }) => {
    test.setTimeout(180_000);
    const human = new HumanBehavior(page);
    const { stamp } = await signupAndOpenOnboarding(page, human);

    await human.humanType(
      page.getByRole("textbox", { name: /nome da organização/i }),
      `Empresa E2E ${stamp}`
    );
    await selectComboboxByLabel(page, /perfil da empresa/i, "LTDA - Sociedade Limitada");
    await selectComboboxByLabel(page, /^estado/i, "São Paulo");
    await human.humanType(page.getByRole("textbox", { name: /cidade/i }), "São Paulo");
    await selectComboboxByLabel(page, /regime tributário/i, "Simples Nacional");
    await selectComboboxByLabel(page, /tipo de negócio/i, "Produtos e Serviços");
    await human.humanClick(page.getByRole("button", { name: /^continuar$/i }));

    await expect(page).toHaveURL(/step=users/, { timeout: 60_000 });
    await clickSkip(page, human);

    await expect(page).toHaveURL(/step=pipeline/, { timeout: 60_000 });
    const continuePipeline = page.getByRole("button", { name: /^continuar$/i }).last();
    if (await continuePipeline.isDisabled()) {
      const useDefaults = page.getByRole("button", { name: /usar etapas sugeridas/i });
      if (await useDefaults.isVisible().catch(() => false)) await human.humanClick(useDefaults);
    }
    await expect(continuePipeline).toBeEnabled({ timeout: 20_000 });
    await human.humanClick(continuePipeline);

    await expect(page).toHaveURL(/step=products/, { timeout: 60_000 });
    await clickSkip(page, human);

    await expect(page).not.toHaveURL(/step=evolution/);
    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 90_000 });
  });
});
