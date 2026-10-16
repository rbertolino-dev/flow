import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";

/**
 * Self-signup em /cadastro: página pública para o usuário criar a própria conta
 * e seguir para o onboarding.
 */

test.describe("Cadastro self-signup @human-behavior", () => {
  test("exibe formulário de criar conta e link para login", async ({ page }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/cadastro");
    await human.randomDelay(400, 800);

    await expect(page.getByRole("heading", { name: /criar conta/i })).toBeVisible();
    await expect(page.getByTestId("cadastro-form")).toBeVisible();
    await expect(page.getByTestId("cadastro-fullname")).toBeVisible();
    await expect(page.getByTestId("cadastro-email")).toBeVisible();
    await expect(page.getByTestId("cadastro-password")).toBeVisible();
    await expect(page.getByTestId("cadastro-submit")).toBeVisible();

    await human.humanClick(page.getByTestId("cadastro-login-link"));
    await expect(page).toHaveURL(/\/login/);
  });

  test("valida campos obrigatórios e senha curta @accessibility", async ({ page }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/cadastro");
    await human.randomDelay(300, 600);

    // HTML5 required: submit sem preencher não deve navegar
    await human.humanClick(page.getByTestId("cadastro-submit"));
    await expect(page).toHaveURL(/\/cadastro/);

    await human.humanType(page.getByTestId("cadastro-fullname"), "Teste E2E");
    await human.humanType(page.getByTestId("cadastro-email"), "teste.e2e@mailinator.com");
    await human.humanType(page.getByTestId("cadastro-password"), "123"); // < 6

    await human.hesitate(200, 400);
    await human.humanClick(page.getByTestId("cadastro-submit"));

    // Continua na página de cadastro (minLength / validação)
    await expect(page).toHaveURL(/\/cadastro/);
    await expect(page.getByTestId("cadastro-form")).toBeVisible();
  });

  test("cria conta e redireciona para onboarding", async ({ page }) => {
    test.setTimeout(90_000);
    const human = new HumanBehavior(page);
    const stamp = Date.now();
    const email = `e2e.cadastro.${stamp}@mailinator.com`;
    const password = "Teste123!";
    const fullName = `E2E Cadastro ${stamp}`;

    await human.humanNavigate("/cadastro");
    await human.randomDelay(500, 1000);

    await human.humanType(page.getByTestId("cadastro-fullname"), fullName);
    await human.randomDelay(200, 400);
    await human.humanType(page.getByTestId("cadastro-email"), email);
    await human.randomDelay(200, 400);
    await human.humanType(page.getByTestId("cadastro-password"), password);

    await human.hesitate(400, 800);
    await human.humanClick(page.getByTestId("cadastro-submit"));

    // Sucesso: onboarding (ou toast de sucesso + redirect)
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
    await expect(
      page.getByText(/bem-vindo|onboarding|dados da organização|configurar/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
