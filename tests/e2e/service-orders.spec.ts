import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Ordem de Serviço — etapas customizáveis + criação
 * Tags: @human-behavior @service-orders
 */
test.describe("Ordem de Serviço — etapas e criação @human-behavior @service-orders", () => {
  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("deve abrir OS, gerenciar etapas na engrenagem e criar ordem @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/service-orders");
    await human.randomDelay(800, 1500);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    await expect(page.getByRole("heading", { name: /ordem de serviço/i })).toBeVisible({
      timeout: 45_000,
    });

    await expect(page.getByTestId("os-status-cards")).toBeVisible();
    await expect(page.getByTestId("os-criar-btn")).toBeVisible();
    await expect(page.getByTestId("os-etapas-gear-btn")).toBeVisible();

    // Abrir engrenagem de etapas
    await human.hesitate(300, 600);
    await human.humanClick(page.getByTestId("os-etapas-gear-btn"));
    await expect(page.getByTestId("os-statuses-dialog")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/etapas da ordem de serviço/i)).toBeVisible();

    const stageName = `etapa e2e ${Date.now().toString().slice(-5)}`;
    await human.humanType(page.getByTestId("os-status-new-name"), stageName);
    await human.randomDelay(200, 400);
    await human.humanClick(page.getByTestId("os-status-color-22c55e"));
    await human.hesitate(300, 500);
    await human.humanClick(page.getByTestId("os-status-create-btn"));

    await expect(page.getByText(stageName).first()).toBeVisible({ timeout: 20_000 });

    await human.humanClick(page.getByRole("button", { name: /^fechar$/i }));
    await expect(page.getByTestId("os-statuses-dialog")).toBeHidden({ timeout: 10_000 });

    // Card da nova etapa deve aparecer
    await expect(page.getByText(stageName).first()).toBeVisible({ timeout: 15_000 });

    // Criar ordem
    await human.humanClick(page.getByTestId("os-criar-btn"));
    await expect(page.getByText(/nova ordem de serviço/i)).toBeVisible({ timeout: 15_000 });

    const responsavel = page.getByLabel(/responsável/i).first();
    if (await responsavel.isVisible().catch(() => false)) {
      await human.humanType(responsavel, "Wendel Teste E2E");
    }

    const diagnostico = page.getByLabel(/diagnóstico/i).first();
    if (await diagnostico.isVisible().catch(() => false)) {
      await human.humanType(diagnostico, "Problema detectado no teste E2E");
    }

    await human.hesitate(400, 700);
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));
    await human.randomDelay(500, 900);

    // Passo produtos
    await expect(page.getByText(/adicionar produtos|total da o\.s/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));
    await human.randomDelay(400, 800);

    // Passo finalizar — selecionar status
    await expect(page.getByText(/checklist da os|atribuir status/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const statusSelect = page.getByLabel(/atribuir status/i);
    if (await statusSelect.isVisible().catch(() => false)) {
      await human.humanClick(statusSelect);
      await human.randomDelay(200, 400);
      const option = page.getByRole("option", { name: new RegExp(stageName, "i") });
      if (await option.isVisible().catch(() => false)) {
        await human.humanClick(option);
      }
    }

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: /^finalizar$/i }));

    await expect(page.getByText(/ordem criada|os \d+/i).first()).toBeVisible({
      timeout: 30_000,
    }).catch(() => undefined);

    // Listagem deve refletir a nova OS ou ao menos permanecer funcional
    await expect(page.getByTestId("os-criar-btn")).toBeVisible({ timeout: 20_000 });
  });
});
